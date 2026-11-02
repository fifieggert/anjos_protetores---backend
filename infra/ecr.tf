# ECR (Elastic Container Registry): repositórios privados de imagens Docker.
# O GitHub Actions faz build e push das imagens aqui; a EC2 faz pull delas no deploy.

locals {
  # Cria anjos-backend e anjos-frontend.
  repositorios = toset(["backend", "frontend"])
}

resource "aws_ecr_repository" "app" {
  for_each = local.repositorios

  name = "${var.project}-${each.key}"

  # Tags mutáveis permitem reaproveitar uma tag como "latest". O deploy deve usar a tag do
  # commit (SHA), que é única e mostra exatamente qual versão está no ar.
  image_tag_mutability = "MUTABLE"

  # Procura vulnerabilidades conhecidas (CVEs) em cada imagem enviada. Gratuito no modo básico.
  image_scanning_configuration {
    scan_on_push = true
  }

  # Projeto acadêmico: permite o "terraform destroy" apagar o repositório mesmo com imagens.
  force_delete = true
}

# Mantém só as 10 imagens mais recentes de cada repositório. O ECR cobra por GB armazenado,
# e 10 versões são suficientes para voltar a uma versão anterior (rollback).
resource "aws_ecr_lifecycle_policy" "app" {
  for_each = aws_ecr_repository.app

  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Manter apenas as 10 imagens mais recentes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
