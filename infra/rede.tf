# Rede: uma VPC (rede privada isolada na AWS) com subnets públicas, para o servidor web,
# e subnets privadas, para o banco de dados, que não pode ser acessado pela internet.

# Lista as zonas de disponibilidade (datacenters separados) da região, para espalhar as subnets.
data "aws_availability_zones" "disponiveis" {
  state = "available"
}

locals {
  # Duas zonas: o RDS exige que o grupo de subnets do banco cubra pelo menos duas.
  azs = slice(data.aws_availability_zones.disponiveis.names, 0, 2)
}

# VPC 10.0.0.0/16: faixa de endereços privados de onde saem todas as subnets.
resource "aws_vpc" "principal" {
  cidr_block = "10.0.0.0/16"

  # Necessário para que o endpoint do RDS (um nome DNS) seja resolvido dentro da VPC.
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project}-vpc" }
}

# Internet gateway: a "porta" da VPC para a internet. Sem ele nada entra nem sai.
resource "aws_internet_gateway" "principal" {
  vpc_id = aws_vpc.principal.id

  tags = { Name = "${var.project}-igw" }
}

# Subnets públicas (10.0.1.0/24 e 10.0.2.0/24): onde fica a EC2, que precisa ser acessada pela internet.
resource "aws_subnet" "publica" {
  count = 2

  vpc_id            = aws_vpc.principal.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = local.azs[count.index]

  # A EC2 recebe um IP público temporário já na criação, para o user_data conseguir baixar o
  # Docker antes de o Elastic IP ser associado. Quando o Elastic IP entra, ele substitui esse IP.
  map_public_ip_on_launch = true

  tags = { Name = "${var.project}-publica-${local.azs[count.index]}" }
}

# Subnets privadas (10.0.11.0/24 e 10.0.12.0/24): onde fica o banco. Não têm rota para a internet.
# Não há NAT Gateway (custaria cerca de US$ 40/mês): o banco não precisa sair para a internet.
resource "aws_subnet" "privada" {
  count = 2

  vpc_id            = aws_vpc.principal.id
  cidr_block        = "10.0.${count.index + 11}.0/24"
  availability_zone = local.azs[count.index]

  tags = { Name = "${var.project}-privada-${local.azs[count.index]}" }
}

# Tabela de rotas pública: manda todo o tráfego para fora da VPC (0.0.0.0/0) pelo internet gateway.
# As subnets privadas usam a tabela principal da VPC, que só tem a rota interna (local).
resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.principal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.principal.id
  }

  tags = { Name = "${var.project}-rt-publica" }
}

resource "aws_route_table_association" "publica" {
  count = 2

  subnet_id      = aws_subnet.publica[count.index].id
  route_table_id = aws_route_table.publica.id
}

# ---- Security groups (firewalls) ----
# Obs.: a AWS não aceita acentos nas descrições de security groups e regras, por isso elas
# estão sem acento.

# SG web: protege a EC2. Só libera HTTP e HTTPS. A porta 22 (SSH) fica fechada de propósito:
# o acesso administrativo é feito pelo SSM Session Manager, sem porta aberta e sem chave SSH.
resource "aws_security_group" "web" {
  name        = "${var.project}-web"
  description = "Servidor web: entrada 80/443 da internet, sem SSH (acesso via SSM)"
  vpc_id      = aws_vpc.principal.id

  tags = { Name = "${var.project}-web" }
}

resource "aws_vpc_security_group_ingress_rule" "web_http" {
  security_group_id = aws_security_group.web.id
  description       = "HTTP (redireciona para HTTPS e valida o certificado)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "web_https" {
  security_group_id = aws_security_group.web.id
  description       = "HTTPS"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

# Saída liberada: a EC2 precisa baixar pacotes, puxar imagens do ECR, falar com o SSM e com o banco.
resource "aws_vpc_security_group_egress_rule" "web_saida" {
  security_group_id = aws_security_group.web.id
  description       = "Toda a saida"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# SG banco: protege o RDS. Só aceita a porta 3306 (MySQL) vinda de quem está no SG web,
# ou seja, apenas a EC2 da aplicação consegue conectar no banco.
resource "aws_security_group" "banco" {
  name        = "${var.project}-banco"
  description = "Banco MySQL: entrada 3306 somente do SG web"
  vpc_id      = aws_vpc.principal.id

  tags = { Name = "${var.project}-banco" }
}

resource "aws_vpc_security_group_ingress_rule" "banco_mysql" {
  security_group_id            = aws_security_group.banco.id
  description                  = "MySQL vindo da EC2 (SG web)"
  referenced_security_group_id = aws_security_group.web.id
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
}
