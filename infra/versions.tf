# Versões do Terraform e dos providers.
# Fixar as versões garante que o mesmo código gere a mesma infraestrutura em qualquer máquina.
# O arquivo .terraform.lock.hcl (gerado no "terraform init") registra a versão exata baixada
# e deve ser versionado no Git.

terraform {
  required_version = ">= 1.9"

  required_providers {
    # Provider da AWS: cria os recursos na nuvem (VPC, EC2, RDS, ECR, IAM, SSM).
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # Provider random: gera as senhas aleatórias (banco e JWT) sem que ninguém precise inventá-las.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.region

  # Todas as tags abaixo são aplicadas automaticamente em todos os recursos.
  # Ajudam a identificar no console (e na fatura) o que pertence ao projeto.
  default_tags {
    tags = var.tags
  }
}
