# Anjos Protetores: API (backend)

API REST do **Anjos Protetores**, sistema web de gestão de um abrigo de animais: cadastro de animais, doações e estoque, processo de adoção com termo em PDF, eventos e painel da coordenação. Projeto da disciplina de Portfólio (Engenharia de Software, Católica SC).

- **Sistema em produção:** https://abrigoanjosprotetores.com.br
- **Frontend:** https://github.com/fifieggert/anjos_protetores---frontend
- **Documentação completa (Wiki):** aba *Wiki* deste repositório

## Stack

Node.js 24 · TypeScript · Express 5 · Prisma 7 (MySQL) · Zod · JWT · bcrypt · helmet · express-rate-limit · multer + sharp (upload de imagens) · pdfkit (termo de adoção) · Vitest.

Infraestrutura na AWS (sa-east-1), descrita em Terraform: EC2 com Docker Compose (Caddy, web, api), RDS MySQL e S3 privado para as fotos. CI/CD com GitHub Actions e SonarCloud.

## Arquitetura

Cada requisição atravessa as camadas: **rota** (caminho e proteções) → **middleware** (autenticação, perfil, validação) → **controller** → **service** (regras de negócio e transações) → **repository** (Prisma).

```
src/
  routes/       caminhos e middlewares de cada módulo
  middleware/   autenticação JWT, perfis, validação (Zod), limite de requisições, upload, erros
  controller/   traduz HTTP para chamadas de serviço
  service/      regras de negócio (adoção, estoque, usuários, imagens, termo em PDF)
  repository/   acesso ao banco
  validators/   esquemas Zod de entrada
  storage/      armazenamento de imagens (disco local em dev, S3 em produção)
  utils/        AppError, fila única, datas, senha
prisma/         schema e migrations
infra/          Terraform (AWS)
deploy/         Caddyfile, docker-compose de produção, deploy.sh
docs/           guias de deploy, upload e dashboard
```

## Rodar localmente

Pré-requisitos: Node.js na versão do `.nvmrc` (24.22.1) e Docker.

```bash
npm ci
cp .env.example .env          # preencha DATABASE_URL e JWT_SECRET (veja abaixo)
docker compose up -d mysql    # MySQL local na porta 3307
npx prisma migrate deploy     # cria as tabelas
npm run criar-admin -- --nome="Seu Nome" --cpf=SEU_CPF_11_DIGITOS --email=voce@exemplo.com --senha=SuaSenhaForte1
npm run dev                   # API em http://localhost:4000
```

Valores para o `.env` local (o banco do `docker-compose.yml` é só de teste):

```
DATABASE_URL=mysql://anjos:senha_local_de_teste@localhost:3307/anjos_protetores
JWT_SECRET=<gere com: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
```

As imagens, em desenvolvimento, ficam na pasta `uploads/` (ignorada pelo Git). Em produção usam S3.

## Variáveis de ambiente

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `DATABASE_URL` | sim | Conexão com o MySQL |
| `JWT_SECRET` | sim | Segredo que assina os tokens |
| `PORT` | não | Porta da API (padrão 4000) |
| `CORS_ORIGIN` | não | Origens permitidas, separadas por vírgula |
| `TRUST_PROXY` | não | Número de proxies à frente da API (1 em produção) |
| `ABRIGO_CIDADE`, `ABRIGO_TELEFONE` | não | Impressos no termo de adoção |
| `STORAGE_DRIVER` | não | `local` (dev) ou `s3` (produção) |
| `S3_BUCKET`, `AWS_REGION` | só com `s3` | Bucket e região das imagens |

Nunca coloque chaves de acesso da AWS no `.env`: em produção a instância usa uma role (IMDSv2). Os segredos de produção ficam no SSM Parameter Store.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API com recarga automática |
| `npm test` / `npm run test:cov` | Testes / testes com cobertura (mínimo de 75% no CI) |
| `npm run lint` | oxlint |
| `npm run typecheck` | Checagem de tipos, incluindo os testes |
| `npm run build` / `npm start` | Compila para `dist/` / sobe a versão compilada |
| `npm run criar-admin` | Cria o primeiro usuário ADMIN |

## Principais rotas

Prefixo `/api`. Perfis: **ADMIN** (coordenação) e **VOLUNTARIO**.

| Grupo | Rotas | Acesso |
|---|---|---|
| Autenticação | `POST /auth/login` | Público |
| Site público | `GET /publico/animais`, `/eventos`, `/estatisticas`; `POST /publico/interesses` | Público (interesse limitado a 5 por hora por IP) |
| Animais | CRUD em `/animais` | Logado; exclusão só ADMIN |
| Estoque | `/itens-estoque`, `/doacoes`, `/saidas-estoque` | Logado |
| Adoção | `/solicitacoes-adocao`, `/termos-adocao` | ADMIN |
| Eventos | `/eventos` | ADMIN (escrita) |
| Usuários | `/usuarios` | ADMIN (troca da própria senha: qualquer logado) |
| Painel | `GET /dashboard` | ADMIN |
| Imagens | `POST /imagens`; `GET /imagens/:arquivo` | Envio logado; leitura pública |
| Saúde | `GET /health`, `/health/ready` | Público |

Detalhes do painel e do upload em [`docs/dashboard.md`](docs/dashboard.md) e [`docs/upload.md`](docs/upload.md).

## Segurança, em resumo

Senhas com bcrypt; JWT HS256 com expiração de 30 minutos; autorização por perfil no servidor; validação de toda entrada com Zod; helmet e CORS restrito; limite de requisições (interesse público, troca de senha, uploads e leitura de imagens); upload com checagem do tipo real do arquivo, limite de megapixels, remoção de EXIF e fila de processamento única; bucket S3 privado com TLS obrigatório; mínimo de dados pessoais (só nome e telefone de quem tem interesse em adotar).

## Deploy

Merge na `main` dispara o workflow **Deploy** (GitHub Actions, autenticação por OIDC): constrói a imagem, envia ao ECR e atualiza a EC2 por SSM. Não há acesso por SSH. Guias: [`docs/deploy-aws.md`](docs/deploy-aws.md), [`docs/deploy-backend.md`](docs/deploy-backend.md) e [`infra/README.md`](infra/README.md).

## Autoria

Sophia Eggert Freire da Rocha, Engenharia de Software, Católica SC.
