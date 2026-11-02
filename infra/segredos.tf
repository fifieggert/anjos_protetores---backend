# Segredos: gerados aleatoriamente pelo Terraform e guardados criptografados no SSM Parameter
# Store (tipo SecureString). Nenhum segredo fica no Git, em arquivo .env ou na imagem Docker:
# a EC2 lê os valores no deploy usando a permissão da sua role.
#
# Atenção: o Terraform guarda esses valores no arquivo de estado (terraform.tfstate) em texto
# puro. Por isso o .tfstate está no .gitignore e deve ser tratado como um arquivo secreto.

# Senha do banco: 32 caracteres. Os especiais foram limitados aos que o RDS aceita
# (ele proíbe / @ " e espaço) e que não causam problema em arquivos .env (# $ ' `).
resource "random_password" "banco" {
  length           = 32
  special          = true
  override_special = "-_.!*()=+"
  min_lower        = 1
  min_upper        = 1
  min_numeric      = 1
  min_special      = 1
}

# JWT_SECRET: 64 caracteres só com letras e números (assina os tokens de login da API).
resource "random_password" "jwt" {
  length  = 64
  special = false
}

locals {
  # Prefixo dos parâmetros: /anjos/...
  ssm_prefixo = "/${var.project}"

  # DATABASE_URL no formato que o projeto usa (adapter MariaDB do Prisma + Prisma CLI):
  # - a senha vai "URL-encoded" (urlencode), para caracteres como + ou ( não quebrarem a URL;
  # - ssl=true: liga o TLS no driver MariaDB usado pela API;
  # - sslaccept=strict e sslcert: ligam e validam o TLS no "prisma migrate deploy" (o motor de
  #   migrations do Prisma ignora o "ssl=true" e o driver MariaDB ignora estes dois);
  # - /certs/rds-ca.pem é o certificado da AWS baixado pelo user_data em
  #   /opt/anjos/certs/rds-ca.pem e montado no container em /certs (ver README.md).
  database_url = format(
    "mysql://%s:%s@%s:%d/%s?ssl=true&sslaccept=strict&sslcert=/certs/rds-ca.pem",
    local.db_usuario,
    urlencode(random_password.banco.result),
    aws_db_instance.banco.address,
    aws_db_instance.banco.port,
    local.db_nome,
  )
}

resource "aws_ssm_parameter" "db_password" {
  name        = "${local.ssm_prefixo}/db_password"
  description = "Senha do usuario ${local.db_usuario} do MySQL (RDS)"
  type        = "SecureString"
  value       = random_password.banco.result
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "${local.ssm_prefixo}/jwt_secret"
  description = "JWT_SECRET da API (assina os tokens de login)"
  type        = "SecureString"
  value       = random_password.jwt.result
}

resource "aws_ssm_parameter" "database_url" {
  name        = "${local.ssm_prefixo}/database_url"
  description = "DATABASE_URL da API, com TLS obrigatorio"
  type        = "SecureString"
  value       = local.database_url
}
