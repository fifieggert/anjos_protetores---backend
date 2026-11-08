# Servidor da aplicação: uma EC2 que roda os containers do backend e do frontend.

data "aws_caller_identity" "atual" {}

# Imagem (AMI) mais recente do Amazon Linux 2023, consultada no catálogo público da AWS.
# AL2023 já vem com o agente do SSM e a AWS CLI instalados.
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# ---- Permissões da EC2 (IAM role + instance profile) ----
# A role é a "identidade" da máquina na AWS: em vez de guardar chaves de acesso no servidor,
# a EC2 recebe credenciais temporárias que a AWS renova sozinha.

resource "aws_iam_role" "ec2" {
  name        = "${var.project}-ec2"
  description = "Role da EC2 da aplicacao: SSM, pull no ECR e leitura dos parametros /${var.project}/*"

  # Só o serviço EC2 pode assumir esta role.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Política gerenciada pela AWS que permite o acesso pelo SSM Session Manager (terminal sem SSH)
# e o Run Command (usado pelo GitHub Actions para fazer o deploy).
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Permissões mínimas próprias: baixar imagens dos nossos repositórios ECR e ler os segredos.
resource "aws_iam_role_policy" "ec2_app" {
  name = "${var.project}-ec2-app"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # O login no ECR (docker login) não aceita restrição por repositório.
        Sid      = "EcrLogin"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        # Pull (somente leitura) apenas nos dois repositórios do projeto.
        Sid    = "EcrPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
        ]
        Resource = [for r in aws_ecr_repository.app : r.arn]
      },
      {
        # Leitura dos parâmetros /anjos/* (senha do banco, JWT_SECRET, DATABASE_URL).
        # A descriptografia usa a chave KMS padrão do SSM (aws/ssm), liberada por ela mesma
        # para quem tem permissão no SSM, então não é preciso permissão de KMS aqui.
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

# O instance profile é o "envelope" que liga a role à EC2.
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project}-ec2"
  role = aws_iam_role.ec2.name
}

# ---- A máquina ----

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.publica[0].id
  vpc_security_group_ids = [aws_security_group.web.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  # Sem key pair: não existe chave SSH. O acesso é só pelo SSM Session Manager.

  # Instala Docker + docker compose e cria /opt/anjos no primeiro boot.
  # O replace troca quebras de linha do Windows (CRLF) por LF: com CRLF o bash do Linux falha.
  user_data = replace(file("${path.module}/user_data.sh"), "\r\n", "\n")

  # IMDSv2 obrigatório: o serviço de metadados (de onde saem as credenciais da role) só responde
  # com token de sessão, o que bloqueia ataques de SSRF que tentam roubar essas credenciais.
  # hop_limit = 2: a resposta do token atravessa um "salto" a mais na rede (a bridge do
  # Docker), para que o container da API use as credenciais da role (SDK da AWS) e grave as
  # imagens no S3 sem chave de acesso fixa. Com 1, só o host alcançava o serviço.
  # Efeito colateral: qualquer container da máquina (api, web, caddy) passa a conseguir as
  # credenciais da role. Por isso a role tem só o mínimo (ver ec2_app e ec2_uploads).
  # Mudar este valor não recria a EC2 (a AWS altera na hora, sem reiniciar).
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  # Disco de 20 GB gp3 (mais barato e rápido que o gp2), criptografado em repouso.
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    delete_on_termination = true
  }

  tags = { Name = "${var.project}-app" }

  lifecycle {
    # Quando a AWS publicar uma AMI nova, o Terraform não recria a máquina sozinho
    # (isso apagaria o servidor em uso). As atualizações vêm pelo dnf.
    ignore_changes = [ami]
  }
}

# Elastic IP: IP público fixo. Ele não muda se a EC2 for parada e ligada de novo, por isso é
# o IP que vai no registro DNS (tipo A) do domínio no Registro.br.
resource "aws_eip" "app" {
  domain = "vpc"

  tags = { Name = "${var.project}-eip" }

  depends_on = [aws_internet_gateway.principal]
}

resource "aws_eip_association" "app" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}
