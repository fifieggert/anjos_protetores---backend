# Armazenamento das imagens enviadas pelo sistema (fotos de animais e de eventos) no S3.
#
# O bucket é PRIVADO: ninguém acessa os arquivos direto pela internet. Só a API (container
# na EC2, usando a role da instância) lê e grava, e apenas dentro do prefixo uploads/.
# Para mostrar uma imagem no navegador, a API entrega o arquivo ou gera uma URL pré-assinada
# (temporária); o bucket nunca fica público.

locals {
  # Nome de bucket é único no mundo inteiro (em todas as contas da AWS). O ID da conta no fim
  # garante isso sem depender de valor aleatório, e o nome não muda entre applies.
  # Ex.: anjos-uploads-123456789012
  uploads_bucket = "${var.project}-uploads-${data.aws_caller_identity.atual.account_id}"

  # Único prefixo onde a aplicação pode mexer.
  uploads_prefixo = "uploads/"
}

resource "aws_s3_bucket" "uploads" {
  bucket = local.uploads_bucket

  # Projeto acadêmico: permite o "terraform destroy" apagar o bucket mesmo com imagens dentro
  # (o mesmo critério do force_delete do ECR). As fotos são apagadas junto, sem volta.
  force_destroy = true

  tags = { Name = local.uploads_bucket }
}

# Bloqueia qualquer forma de acesso público (ACL ou política), nas 4 opções.
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# ACLs desligadas: o dono do bucket (a conta) é dono de todos os objetos. Permissão só por IAM
# e pela política do bucket, que é mais fácil de auditar.
resource "aws_s3_bucket_ownership_controls" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Criptografia em repouso com chave gerenciada pelo S3 (SSE-S3, AES-256). Grátis e não exige
# permissão de KMS na role.
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Versionamento desligado: uma foto apagada ou substituída não fica guardada (e cobrada) em
# versões antigas. "Disabled" só vale para bucket que nunca teve versionamento, que é o caso.
resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Disabled"
  }
}

# Uploads grandes podem ser enviados em partes (multipart). Se o envio for interrompido, as
# partes ficam no bucket, invisíveis e cobradas. Esta regra as apaga após 1 dia.
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "abortar-multipart-incompleto"
    status = "Enabled"

    # Filtro vazio: vale para o bucket inteiro.
    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# Política do bucket: recusa requisições sem HTTPS (TLS) e com TLS abaixo de 1.2, venha de
# quem vier. O aws:SecureTransport só garante que é HTTPS, não a versão; por isso a 2ª regra.
resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "ExigirTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
      {
        Sid       = "ExigirTLS12"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*",
        ]
        Condition = {
          NumericLessThan = { "s3:TlsVersion" = 1.2 }
        }
      },
    ]
  })

  # Aplica a política só depois do bloqueio de acesso público e do ownership (evita erro de
  # concorrência na API do S3 quando os recursos são criados juntos).
  depends_on = [
    aws_s3_bucket_public_access_block.uploads,
    aws_s3_bucket_ownership_controls.uploads,
  ]
}

# ---- Permissão da EC2 (mesmo padrão do aws_iam_role_policy.ec2_app em compute.tf) ----
# Privilégio mínimo: ler, gravar e apagar objetos SOMENTE em uploads/*, e listar SOMENTE esse
# prefixo. Nada de s3:* nem de acesso a outros buckets. A API (container) usa estas
# credenciais pelo IMDSv2 (por isso o hop limit 2 em compute.tf).
resource "aws_iam_role_policy" "ec2_uploads" {
  name = "${var.project}-ec2-uploads"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ObjetosUploads"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
        ]
        Resource = "${aws_s3_bucket.uploads.arn}/${local.uploads_prefixo}*"
      },
      {
        # ListBucket é uma ação sobre o bucket (não sobre objetos): a restrição ao prefixo é
        # feita pela condição s3:prefix.
        Sid      = "ListarUploads"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.uploads.arn
        Condition = {
          StringLike = {
            "s3:prefix" = [local.uploads_prefixo, "${local.uploads_prefixo}*"]
          }
        }
      },
    ]
  })
}

# ---- Configuração para a API ----
# Nome do bucket no SSM Parameter Store, como String (não é segredo). O deploy.sh lê este
# parâmetro e grava S3_BUCKET no .env da API, como já faz com os outros /anjos/*.
# A role da EC2 já pode ler /anjos/* (compute.tf), então não precisa de permissão nova.
resource "aws_ssm_parameter" "s3_bucket" {
  name        = "${local.ssm_prefixo}/s3_bucket"
  description = "Bucket S3 dos uploads de imagens (nao secreto)"
  type        = "String"
  value       = aws_s3_bucket.uploads.bucket
}
