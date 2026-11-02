# Integração com o GitHub Actions por OIDC (OpenID Connect).
# Em vez de guardar uma chave de acesso da AWS (que nunca expira) nos segredos do GitHub,
# cada execução do workflow recebe do GitHub um token assinado, troca esse token por
# credenciais temporárias da AWS (válidas por 1 hora) e assume a role abaixo.

# Registra o GitHub como provedor de identidade confiável na conta AWS.
# Obs.: só pode existir um por conta. Se a conta já tiver um, o apply vai falhar (ver README).
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # Impressões digitais dos certificados do GitHub. Hoje a AWS valida o GitHub pela própria
  # cadeia de CAs e ignora estes valores, mas o campo ainda é pedido por versões do provider.
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

locals {
  # Só estas origens podem assumir a role: os dois repositórios, e apenas na branch main.
  # Um PR, outra branch ou um fork não conseguem fazer deploy.
  github_subs = [
    "repo:${var.github_repo_backend}:ref:refs/heads/main",
    "repo:${var.github_repo_frontend}:ref:refs/heads/main",
  ]
}

resource "aws_iam_role" "github_actions" {
  name        = "github-actions-deploy"
  description = "Deploy pelo GitHub Actions (OIDC), somente branch main dos repos do projeto"

  # Trust policy: QUEM pode assumir a role.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          # O token tem que ter sido emitido para a AWS...
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # ...e vir de um dos repositórios, na branch main.
          "token.actions.githubusercontent.com:sub" = local.github_subs
        }
      }
    }]
  })
}

# Permissões: O QUE a role pode fazer (o mínimo para o deploy).
resource "aws_iam_role_policy" "github_actions" {
  name = "github-actions-deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # docker login no ECR (não aceita restrição por repositório).
        Sid      = "EcrLogin"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        # Push (e a leitura que o docker faz durante o push) só nos dois repositórios.
        Sid    = "EcrPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
        ]
        Resource = [for r in aws_ecr_repository.app : r.arn]
      },
      {
        # Rodar comandos na EC2 pelo SSM (ex.: docker compose pull && up), mas somente com o
        # documento AWS-RunShellScript e somente na instância deste projeto.
        Sid    = "DeployNaEc2"
        Effect = "Allow"
        Action = "ssm:SendCommand"
        Resource = [
          "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
          aws_instance.app.arn,
        ]
      },
      {
        # Acompanhar o resultado dos comandos. Estas ações não aceitam restrição por recurso.
        Sid    = "AcompanharDeploy"
        Effect = "Allow"
        Action = [
          "ssm:GetCommandInvocation",
          "ssm:ListCommandInvocations",
        ]
        Resource = "*"
      },
      {
        # Ler os parâmetros /anjos/* (ex.: rodar as migrations com a DATABASE_URL).
        Sid    = "LerParametros"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ]
        Resource = [
          "arn:aws:ssm:${var.region}:${data.aws_caller_identity.atual.account_id}:parameter/${var.project}",
          "arn:aws:ssm:${var.region}:${data.aws_caller_identity.atual.account_id}:parameter/${var.project}/*",
        ]
      },
    ]
  })
}
