#!/bin/bash
# Deploy da aplicação NA EC2 (pasta /opt/anjos). Executado pelo GitHub Actions via SSM
# (como root), mas também pode ser rodado à mão numa sessão do SSM:
#
#   sudo BACKEND_IMAGE=<registro>/anjos-backend:<tag> \
#        FRONTEND_IMAGE=<registro>/anjos-frontend:<tag> /opt/anjos/deploy.sh
#
# Passos:
#   1. login no ECR e download (pull) das imagens novas
#   2. lê os segredos do SSM Parameter Store e gera /opt/anjos/.env (permissão 600)
#   3. aplica as migrations do banco ("prisma migrate deploy") com a imagem NOVA,
#      antes de trocar a API que está no ar
#   4. sobe os containers novos (docker compose up -d)
#   5. espera a API responder 200 em /health/ready (conectada ao banco); senão, falha
#   6. apaga imagens antigas que não estão em uso
#
# Idempotente: rodar duas vezes com as mesmas imagens não muda nada.
# Nenhum segredo é impresso: o script não usa "set -x" e nunca faz echo dos valores.
set -euo pipefail

PASTA=/opt/anjos
COMPOSE_ARQ="$PASTA/docker-compose.prod.yml"
ENV_ARQ="$PASTA/.env"
REGIAO=sa-east-1
DOMINIO=abrigoanjosprotetores.com.br

# O Run Command do SSM roda sem HOME definido; o "docker login" precisa dele para guardar
# a credencial temporária do ECR.
export HOME="${HOME:-/root}"
export AWS_DEFAULT_REGION="$REGIAO"

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }
falha() { echo "[deploy] ERRO: $*" >&2; exit 1; }

# Atalho para o docker compose deste projeto. O compose lê sozinho o .env da pasta
# (é de lá que vêm BACKEND_IMAGE e FRONTEND_IMAGE).
dc() { docker compose --project-directory "$PASTA" -f "$COMPOSE_ARQ" "$@"; }

[[ $EUID -eq 0 ]] || falha "rode como root (sudo)."
[[ -f "$COMPOSE_ARQ" && -f "$PASTA/Caddyfile" ]] || falha "faltam arquivos em $PASTA."
[[ -f "$PASTA/certs/rds-ca.pem" ]] || falha "certificado do RDS ausente em $PASTA/certs (ver user_data.sh)."

# Impede dois deploys ao mesmo tempo nesta máquina.
exec 9>"$PASTA/.deploy.lock"
flock -n 9 || falha "já existe um deploy em andamento."

# ---- Versões das imagens ----
# Só aceita imagens dos repositórios do projeto no ECR, com tag simples. Isso também
# impede que um valor estranho "quebre" o .env.
: "${BACKEND_IMAGE:?informe BACKEND_IMAGE}"
: "${FRONTEND_IMAGE:?informe FRONTEND_IMAGE}"
ECR_RE='^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/anjos-'
[[ $BACKEND_IMAGE =~ ${ECR_RE}backend:[A-Za-z0-9._-]+$ ]] || falha "BACKEND_IMAGE inválida: $BACKEND_IMAGE"
[[ $FRONTEND_IMAGE =~ ${ECR_RE}frontend:[A-Za-z0-9._-]+$ ]] || falha "FRONTEND_IMAGE inválida: $FRONTEND_IMAGE"
REGISTRO="${BACKEND_IMAGE%%/*}"

log "backend:  $BACKEND_IMAGE"
log "frontend: $FRONTEND_IMAGE"

# ---- 1. ECR ----
log "login no ECR"
aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRO" > /dev/null

log "baixando as imagens"
docker pull --quiet "$BACKEND_IMAGE"
docker pull --quiet "$FRONTEND_IMAGE"

# ---- 2. Segredos -> .env ----
# Lê um parâmetro do SSM (descriptografado). O valor vai só para a variável, nunca para o log.
ler_parametro() {
  aws ssm get-parameter --name "$1" --with-decryption --query Parameter.Value --output text
}
# Parâmetros opcionais: se não existirem no SSM, ficam vazios.
ler_opcional() {
  ler_parametro "$1" 2> /dev/null || true
}

log "lendo os parâmetros do SSM"
DATABASE_URL="$(ler_parametro /anjos/database_url)"
JWT_SECRET="$(ler_parametro /anjos/jwt_secret)"
# Lido só para conferir que existe e que a role tem acesso (a senha já vai na DATABASE_URL).
DB_PASSWORD="$(ler_parametro /anjos/db_password)"
ABRIGO_CIDADE="$(ler_opcional /anjos/abrigo_cidade)"
ABRIGO_TELEFONE="$(ler_opcional /anjos/abrigo_telefone)"

[[ -n $DATABASE_URL && -n $JWT_SECRET && -n $DB_PASSWORD ]] || falha "parâmetro obrigatório vazio no SSM."
unset DB_PASSWORD

# Os valores vão entre aspas simples no .env (o docker compose não interpreta nada dentro
# delas). Por isso não podem conter aspas simples nem quebra de linha.
for nome in DATABASE_URL JWT_SECRET ABRIGO_CIDADE ABRIGO_TELEFONE; do
  case "${!nome}" in
    *"'"* | *$'\n'*) falha "o parâmetro de $nome contém aspas simples ou quebra de linha." ;;
  esac
done

# Guarda o .env atual para voltar atrás se a migration falhar.
ENV_ANTERIOR="$PASTA/.env.anterior"
[[ -f $ENV_ARQ ]] && cp -p "$ENV_ARQ" "$ENV_ANTERIOR"

# umask 077: o arquivo já nasce com permissão 600 (só o root lê e escreve).
# Escreve num temporário e renomeia: o .env nunca fica pela metade.
log "gerando $ENV_ARQ"
(
  umask 077
  cat > "$ENV_ARQ.novo" << EOF
# Gerado por deploy.sh em $(date -u +%Y-%m-%dT%H:%M:%SZ). NÃO edite à mão: o próximo deploy
# sobrescreve. Os segredos vêm do SSM Parameter Store (/anjos/*).

# Versões em execução (usadas pelo docker-compose.prod.yml)
BACKEND_IMAGE='$BACKEND_IMAGE'
FRONTEND_IMAGE='$FRONTEND_IMAGE'

# Configuração da API
NODE_ENV='production'
DATABASE_URL='$DATABASE_URL'
JWT_SECRET='$JWT_SECRET'
CORS_ORIGIN='https://$DOMINIO'
TRUST_PROXY='1'
ABRIGO_CIDADE='$ABRIGO_CIDADE'
ABRIGO_TELEFONE='$ABRIGO_TELEFONE'
EOF
)
chmod 600 "$ENV_ARQ.novo"
mv -f "$ENV_ARQ.novo" "$ENV_ARQ"
unset DATABASE_URL JWT_SECRET

# Confere se o compose é válido com as variáveis novas (sem imprimir a configuração).
dc config --quiet

# ---- 3. Migrations ----
# Container temporário com a imagem NOVA, mesmo .env e mesmo certificado da API.
# Se falhar, a API antiga continua no ar e o .env volta ao anterior.
log "aplicando as migrations (prisma migrate deploy)"
if ! dc run --rm --no-deps -T api npm run --silent migrate:deploy; then
  if [[ -f $ENV_ANTERIOR ]]; then
    mv -f "$ENV_ANTERIOR" "$ENV_ARQ"
  fi
  falha "as migrations falharam; nada foi trocado (a versão anterior continua no ar)."
fi

# ---- 4. Containers novos ----
# O compose só recria o que mudou (imagem ou configuração).
log "subindo os containers"
dc up -d --remove-orphans

# O Caddyfile é montado como arquivo: mudanças nele não recriam o container, então
# o Caddy recarrega a configuração (sem derrubar conexões).
dc exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

# ---- 5. Readiness ----
# /health/ready só dá 200 se a API conseguiu falar com o banco. A consulta é feita de dentro
# do container (a porta 4000 não é publicada no servidor).
log "esperando a API ficar pronta (/health/ready)"
PRONTA=0
for _ in $(seq 1 30); do
  if dc exec -T api node -e "fetch('http://127.0.0.1:4000/health/ready').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))" 2> /dev/null; then
    PRONTA=1
    break
  fi
  sleep 3
done

if [[ $PRONTA -ne 1 ]]; then
  echo "---- últimas linhas do log da API ----" >&2
  dc logs --no-color --tail 80 api >&2 || true
  falha "a API não ficou pronta em ~2 minutos. Para voltar à versão anterior, veja docs/deploy-aws.md (Rollback)."
fi

# ---- 6. Limpeza ----
# Remove imagens sem uso com mais de 3 dias (as em uso nunca são removidas). As versões
# antigas continuam no ECR (últimas 10) para um rollback.
log "limpando imagens antigas"
docker image prune --all --force --filter "until=72h" > /dev/null
rm -f "$ENV_ANTERIOR"

log "deploy concluído"
dc ps --format "table {{.Service}}\t{{.Image}}\t{{.Status}}"
