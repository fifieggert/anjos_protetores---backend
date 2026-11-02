# Banco de dados: MySQL gerenciado pela AWS (RDS). A AWS cuida de backup, atualizações de
# segurança e da máquina do banco; o projeto só usa o endpoint.

locals {
  db_nome    = "anjos_protetores"
  db_usuario = "anjos"
}

# Grupo de subnets: diz ao RDS em quais subnets ele pode ficar. Usamos só as privadas,
# que não têm rota para a internet.
resource "aws_db_subnet_group" "banco" {
  name        = "${var.project}-banco"
  description = "Subnets privadas do banco"
  subnet_ids  = aws_subnet.privada[*].id
}

# Parameter group: configurações do MySQL que valem para o servidor inteiro.
resource "aws_db_parameter_group" "banco" {
  name        = "${var.project}-mysql84"
  family      = "mysql8.4"
  description = "utf8mb4 e TLS obrigatorio"

  # utf8mb4 guarda qualquer caractere Unicode (acentos, emojis). O collation é o mesmo que as
  # migrations do Prisma usam nas tabelas (utf8mb4_unicode_ci), para não haver mistura.
  parameter {
    name  = "character_set_server"
    value = "utf8mb4"
  }

  parameter {
    name  = "collation_server"
    value = "utf8mb4_unicode_ci"
  }

  # TLS obrigatório: o banco recusa qualquer conexão sem criptografia, então a senha e os dados
  # nunca trafegam em texto puro, nem dentro da VPC.
  parameter {
    name  = "require_secure_transport"
    value = "1"
  }
}

resource "aws_db_instance" "banco" {
  identifier = "${var.project}-mysql"

  # MySQL 8.4 (versão LTS). O 8.0 saiu do suporte padrão do RDS em 31/07/2026 e uma instância
  # nova nele seria cobrada como "Extended Support" (muito mais cara que a própria instância).
  # Também é a mesma versão do docker-compose.yml usado no desenvolvimento.
  engine         = "mysql"
  engine_version = "8.4"
  # Atualizações menores (8.4.x) de segurança são aplicadas pela AWS na janela de manutenção.
  auto_minor_version_upgrade = true
  # Garante que, quando o 8.4 sair do suporte padrão, a AWS não passe a cobrar Extended Support
  # sem aviso: ela obrigará a atualizar de versão.
  engine_lifecycle_support = "open-source-rds-extended-support-disabled"

  instance_class = var.db_instance_class

  # 20 GB gp3, criptografado em repouso (dados e backups) com a chave KMS padrão do RDS.
  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = local.db_nome
  username = local.db_usuario
  password = random_password.banco.result
  port     = 3306

  # Rede: subnets privadas, sem IP público, e só o SG web pode conectar.
  db_subnet_group_name   = aws_db_subnet_group.banco.name
  vpc_security_group_ids = [aws_security_group.banco.id]
  publicly_accessible    = false

  parameter_group_name = aws_db_parameter_group.banco.name

  # Uma única zona (sem réplica de failover). Multi-AZ dobraria o custo; para o TCC,
  # alguns minutos fora do ar numa falha da AWS são aceitáveis.
  multi_az = false

  # Backup automático diário, guardado por 7 dias (permite restaurar o banco em qualquer
  # momento desses 7 dias). Horários em UTC: 06h–07h UTC = 03h–04h em Brasília.
  backup_retention_period = 7
  backup_window           = "06:00-07:00"
  maintenance_window      = "sun:07:30-sun:08:30"
  copy_tags_to_snapshot   = true

  # PROJETO ACADÊMICO: a infraestrutura será destruída depois da apresentação.
  # - deletion_protection = false: permite o "terraform destroy" apagar o banco.
  # - skip_final_snapshot = true: não guarda uma cópia final ao apagar (evita custo de
  #   armazenamento esquecido). Em produção de verdade, os dois seriam o contrário.
  deletion_protection      = false
  skip_final_snapshot      = true
  delete_automated_backups = true

  # Mudanças de configuração valem na hora, sem esperar a janela de manutenção.
  apply_immediately = true

  tags = { Name = "${var.project}-mysql" }
}
