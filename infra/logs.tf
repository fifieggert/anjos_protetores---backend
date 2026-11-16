# Logs centralizados: a saída (stdout/stderr) dos containers da EC2 (caddy, web e api) vai
# para o CloudWatch Logs pelo driver "awslogs" do Docker (deploy/docker-compose.prod.yml).
#
# Quem envia é o daemon do Docker, no host, com as credenciais da role da EC2 (não o
# container). Cada serviço grava num log stream com o próprio nome: caddy, web e api.
#
# ORDEM: aplique este arquivo (terraform apply) ANTES de fazer o deploy do compose com
# awslogs. O compose usa awslogs-create-group=false: sem o grupo ou sem a permissão, o
# Docker não consegue criar o log stream e os containers NÃO sobem.

resource "aws_cloudwatch_log_group" "containers" {
  name = "/${var.project}/containers"

  # 14 dias bastam para investigar um problema e mantêm o custo de armazenamento perto de
  # zero. Depois disso, a AWS apaga os eventos sozinha.
  retention_in_days = 14

  # Criptografia em repouso: o CloudWatch Logs já criptografa tudo com chave gerenciada
  # pela AWS. Uma chave KMS própria (kms_key_id) custaria ~US$ 1/mês sem ganho para o TCC.
}

# ---- Permissão da EC2 (mesmo padrão do aws_iam_role_policy.ec2_app em compute.tf) ----
# Privilégio mínimo: criar log streams e gravar eventos SOMENTE neste grupo. Sem
# logs:CreateLogGroup (o grupo é criado acima pelo Terraform, e o compose não tenta criá-lo)
# e sem leitura: quem consulta os logs é você, pelo console, com o seu usuário.
resource "aws_iam_role_policy" "ec2_logs" {
  name = "${var.project}-ec2-logs"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GravarLogsContainers"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        # O ARN do grupo (CreateLogStream) e o dos seus log streams (PutLogEvents, que
        # termina em :log-stream:<nome>). O ":*" não alcança outros grupos.
        Resource = [
          aws_cloudwatch_log_group.containers.arn,
          "${aws_cloudwatch_log_group.containers.arn}:*",
        ]
      },
    ]
  })
}
