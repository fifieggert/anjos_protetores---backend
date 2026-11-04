# Variáveis de entrada. Os valores padrão servem para o ambiente do TCC; os que não têm padrão
# precisam ser preenchidos no terraform.tfvars (copie de terraform.tfvars.example).

variable "region" {
  description = "Região da AWS. sa-east-1 (São Paulo) deixa o servidor perto dos usuários no Brasil."
  type        = string
  default     = "sa-east-1"
}

variable "project" {
  description = "Prefixo usado no nome dos recursos (ex.: anjos-backend) e no caminho dos parâmetros do SSM (/anjos/...)."
  type        = string
  default     = "anjos"
}

variable "instance_type" {
  description = "Tipo da máquina EC2 que roda os containers. t3.micro (2 vCPU, 1 GB de RAM) é a menor que atende o projeto."
  type        = string
  default     = "t3.micro"
}

variable "db_instance_class" {
  description = "Classe da instância do banco RDS. db.t4g.micro (processador ARM Graviton) é a opção mais barata."
  type        = string
  default     = "db.t4g.micro"
}

variable "domain" {
  description = "Domínio do sistema. O DNS fica no Registro.br (fora do Terraform); aqui ele só aparece nos outputs."
  type        = string
  default     = "abrigoanjosprotetores.com.br"
}

variable "github_repo_backend" {
  description = "Repositório do backend no GitHub, no formato \"dono/repo\". Só ele (e o do frontend) pode assumir a role de deploy."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repo_backend))
    error_message = "Use o formato \"dono/repo\"."
  }
}

variable "github_repo_frontend" {
  description = "Repositório do frontend no GitHub, no formato \"dono/repo\"."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repo_frontend))
    error_message = "Use o formato \"dono/repo\"."
  }
}

# IDs numéricos do dono e dos repositórios no GitHub. Diferente do nome, o ID nunca muda, e o
# GitHub agora coloca esses IDs no claim "sub" do token OIDC (ver github_oidc.tf).
# Não são segredos: qualquer pessoa consegue consultá-los pela API do GitHub.
variable "github_owner_id" {
  description = "ID numérico do dono dos repositórios no GitHub. Ver com: gh api repos/dono/repo --jq .owner.id"
  type        = string
  default     = "168691455"
}

variable "github_repo_id_backend" {
  description = "ID numérico do repositório do backend no GitHub. Ver com: gh api repos/dono/repo --jq .id"
  type        = string
  default     = "1362769302"
}

variable "github_repo_id_frontend" {
  description = "ID numérico do repositório do frontend no GitHub. Ver com: gh api repos/dono/repo --jq .id"
  type        = string
  default     = "1362871407"
}

variable "tags" {
  description = "Tags aplicadas em todos os recursos, para identificar o projeto no console e na fatura."
  type        = map(string)
  default = {
    Project     = "anjos"
    Environment = "tcc"
    ManagedBy   = "terraform"
  }
}
