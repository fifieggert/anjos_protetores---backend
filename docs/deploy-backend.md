# Deploy do backend

Como configurar, empacotar e validar a API para publicação. O deploy na AWS (CD) é uma etapa
futura; aqui ficam a imagem Docker, o ambiente local com Docker e o CI.

> Todos os valores de exemplo deste documento são **falsos**. Segredos reais nunca vão para
> arquivos do repositório: em produção ficam no gerenciador de segredos do ambiente.

## Variáveis de ambiente

| Variável | Para que serve | Obrigatória | Exemplo (falso) |
|---|---|---|---|
| `DATABASE_URL` | Conexão com o MySQL (API e `migrate:deploy`) | Sim | `mysql://anjos:senha-falsa@db.exemplo.internal:3306/anjos_protetores` |
| `JWT_SECRET` | Assina os tokens de login. Sem ela a API não sobe | Sim | `gere-um-valor-aleatorio-longo` |
| `PORT` | Porta HTTP da API | Não (padrão `4000`) | `4000` |
| `CORS_ORIGIN` | Origens do frontend que podem chamar a API, separadas por vírgula, sem barra no final. Origem inválida impede a API de subir | Não (padrão `http://localhost:5173`) | `https://anjos.exemplo.org,https://www.anjos.exemplo.org` |
| `TRUST_PROXY` | Número de proxies (Nginx, load balancer) à frente da API. Com 1 ou mais, o IP real vem do `X-Forwarded-For` e o limitador de requisições conta por visitante. Vazio/`0` = desligado | Não (padrão desligado) | `1` |
| `ABRIGO_CIDADE` | Cidade no fecho do termo de adoção em PDF | Não | `Blumenau/SC` |
| `ABRIGO_TELEFONE` | Telefone do abrigo no termo em PDF | Não | `(47) 3333-0000` |
| `NODE_ENV` | Já vem `production` na imagem | Não | `production` |
| `ADMIN_NOME`, `ADMIN_CPF`, `ADMIN_EMAIL`, `ADMIN_SENHA` | Só para o comando que cria o primeiro ADMIN | Só nesse comando | ver abaixo |

Gerar um `JWT_SECRET` aleatório:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Sobre `TRUST_PROXY`: use o número exato de proxies. Sem proxy, deixe vazio: assim ninguém
foge do limitador forjando o header `X-Forwarded-For`. Valores como `true` ou faixas de IP
são recusados de propósito.

## Rotas de saúde

Ficam fora do `/api`, sem autenticação, sem limitador e fora do log de requisições.

| Rota | Tipo | O que faz |
|---|---|---|
| `GET /health` | liveness | Responde `200 {"status":"ok"}` se o processo está de pé. Não toca no banco. Usada pelo `HEALTHCHECK` da imagem |
| `GET /health/ready` | readiness | Faz `SELECT 1` no banco. `200 {"status":"ok"}` se conectar; `503 {"status":"indisponivel"}` se falhar ou demorar mais de 3 s. Nunca devolve detalhes do erro |

Use `/health` para reiniciar o container e `/health/ready` para decidir se ele recebe
tráfego (load balancer).

## Ambiente local com Docker (desenvolvimento)

O `docker-compose.yml` sobe um MySQL 8.4 e a API. **Não é o ambiente de produção.**

```bash
docker compose up --build        # API em http://localhost:4000, MySQL na porta 3307
docker compose down              # para tudo (mantém os dados)
docker compose down -v           # para e apaga o volume do MySQL
```

- As variáveis da API vêm de `.env.docker.example` (valores falsos). Para mudar algo, copie
  para `.env.docker` (está no `.gitignore`), que tem prioridade.
- A senha do MySQL local tem padrão de teste e pode ser trocada por `MYSQL_PASSWORD` e
  `MYSQL_ROOT_PASSWORD` no ambiente do shell.
- A API aplica as migrations ao subir (`migrate:deploy`).
- O MySQL local usa `mysql_native_password`: sem TLS, o adapter MariaDB do Prisma não
  consegue fazer o primeiro login com o `caching_sha2_password` padrão do MySQL 8. **Em
  produção, use conexão com TLS ao banco e valide a conexão na etapa de CD.**

Criar o primeiro ADMIN no ambiente do compose:

```bash
docker compose exec -e ADMIN_NOME="Coordenação" -e ADMIN_CPF=52998224725 \
  -e ADMIN_EMAIL=admin@exemplo.org -e ADMIN_SENHA='troque-esta-senha' \
  api npm run criar-admin:prod
```

## Imagem de produção

```bash
docker build -t anjos-protetores-backend .
```

- Multi-stage com `node:24-bookworm-slim` (Node 24 LTS, Debian com glibc e OpenSSL). Debian
  em vez de Alpine porque o schema-engine do Prisma (usado no `migrate deploy`) tem como alvo
  mais testado o Debian com OpenSSL 3, e o bcrypt traz binário pronto para glibc.
- A imagem final tem só dependências de produção, `dist/` (com `dist/assets/logo-anjos.png`
  para o termo em PDF), `prisma/` e `prisma.config.ts`. Roda como o usuário `node`
  (não-root), expõe a porta `4000` e tem `HEALTHCHECK` em `/health`.
- O processo principal é `node dist/server.js`. No `docker stop` (SIGTERM), a API para de
  aceitar conexões, espera as requisições em andamento (até 10 s), desconecta o Prisma e sai.

Rodar a imagem (exemplo com arquivo de variáveis fora do git):

```bash
docker run --rm -p 4000:4000 --env-file ./producao.env anjos-protetores-backend
```

### Migrations em produção

Rode antes de subir uma versão nova da API, com a mesma imagem e o mesmo `DATABASE_URL`:

```bash
docker run --rm --env-file ./producao.env anjos-protetores-backend npm run migrate:deploy
```

O `migrate:deploy` (`prisma migrate deploy`) só aplica migrations já criadas em
`prisma/migrations`. Ele não cria migrations novas nem apaga dados. O CLI do Prisma está nas
dependências de produção, então funciona na imagem.

### Primeiro ADMIN em produção

Uma vez, depois das migrations. Passe os dados por variável de ambiente, não por argumento,
para a senha não ficar no histórico do terminal:

```bash
docker run --rm --env-file ./producao.env \
  -e ADMIN_NOME="Coordenação" -e ADMIN_CPF=52998224725 \
  -e ADMIN_EMAIL=admin@exemplo.org -e ADMIN_SENHA='troque-esta-senha' \
  anjos-protetores-backend npm run criar-admin:prod
```

`criar-admin:prod` roda o script já compilado (`node dist/scripts/criarAdmin.js`), sem `tsx`.
No desenvolvimento continua `npm run criar-admin`.

## CI (GitHub Actions)

O arquivo é `.github/workflows/ci.yml`. Ele roda em pull requests e pushes para `develop` e
`main`. Um push novo na mesma branch cancela a execução anterior.

1. **qualidade**: `npm ci`, Prisma client, `lint`, `typecheck`, `test:cov` (falha abaixo de
   75% de cobertura) e `build`. A pasta `coverage/` vira um artifact.
2. **docker**: build da imagem (sem push, com cache do buildx). Depois sobe a imagem sem banco
   e confere que `/health` dá 200, `/health/ready` dá 503, o usuário é `node` e a logo está em
   `dist/assets`.
3. **sonar**: análise no SonarCloud com o `coverage/lcov.info`. Só roda se o segredo
   `SONAR_TOKEN` existir. Antes, preencha `sonar.organization` e `sonar.projectKey` no
   `sonar-project.properties`.

As actions são só oficiais (GitHub, Docker, SonarSource) e ficam fixadas por SHA, com a versão
em comentário.

### Lockfile e binários nativos

O `package-lock.json` atual foi gerado no Windows e não tem as entradas dos binários nativos
do `rolldown` (dependência do vitest), para nenhuma plataforma, por um bug do npm com
`optionalDependencies`. Consequências e solução atual:

- **Imagem Docker:** não é afetada. A imagem final instala só dependências de produção
  (`npm ci --omit=dev`), e o build não usa o vitest.
- **CI:** depois do `npm ci`, um passo instala só `@rolldown/binding-linux-x64-gnu`, na mesma
  versão do `rolldown` travado, com `--no-save` (sem alterar `package.json` nem o lockfile).
- **Correção definitiva (recomendada, em uma tarefa própria):** regenerar o lockfile com
  `rm -rf node_modules package-lock.json && npm install`, rodar todos os testes e revisar o
  diff. Isso atualiza várias dependências dentro das faixas do `package.json` e corrige os
  avisos atuais do `npm audit`. Depois disso, o passo extra do CI pode ser removido.
