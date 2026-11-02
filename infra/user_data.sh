#!/bin/bash
# Script executado uma única vez, no primeiro boot da EC2 (user_data).
# Prepara a máquina para rodar a aplicação em containers. O deploy em si (docker compose up)
# é feito depois pelo GitHub Actions, via SSM.
set -euxo pipefail

# Versão fixa do plugin docker compose: o mesmo script sempre instala a mesma versão.
COMPOSE_VERSION="v2.39.1"

# 1. Atualiza o sistema e instala o Docker (pacote oficial do Amazon Linux 2023).
dnf -y upgrade
dnf -y install docker

# 2. Instala o plugin "docker compose". Ele não existe nos repositórios do Amazon Linux,
#    então é baixado do GitHub e conferido pelo checksum SHA-256 publicado junto.
ARQ="$(uname -m)" # x86_64 (t3) ou aarch64 (t4g)
TMP="$(mktemp -d)"
cd "$TMP"
curl -fsSLO "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-linux-$ARQ"
curl -fsSLO "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-linux-$ARQ.sha256"
sha256sum -c "docker-compose-linux-$ARQ.sha256"
install -D -m 0755 "docker-compose-linux-$ARQ" /usr/local/lib/docker/cli-plugins/docker-compose
cd /
rm -rf "$TMP"

# 3. Liga o Docker agora e em todo boot.
systemctl enable --now docker

# 4. Pasta da aplicação (docker-compose de produção, configuração do Nginx etc.).
mkdir -p /opt/anjos/certs

# 5. Certificados de autoridade (CA) do RDS. Como o banco exige TLS, a API precisa confiar
#    no certificado do RDS, que não vem nas CAs padrão do Node. Esse arquivo é montado no
#    container da API (ver infra/README.md, seção "Conexão com o banco").
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  -o /opt/anjos/certs/rds-ca.pem
chmod 0644 /opt/anjos/certs/rds-ca.pem

docker --version
docker compose version
