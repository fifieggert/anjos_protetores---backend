# Upload de imagens

Fotos de animais (`fotoUrl`) e de eventos (`imagemUrl`) podem ser enviadas pela API e ficam
guardadas no **S3** (bucket privado). Nada é gravado em disco no servidor de produção.

## Fluxo

```
frontend ──POST /api/imagens (multipart, campo "arquivo", token)──► API
   API: confere tipo pelo conteúdo → reencoda (sharp) → grava uploads/<uuid>.<ext> no S3
   ◄── 201 { "url": "/api/imagens/<uuid>.<ext>" }
frontend ──POST/PUT /api/animais ou /api/eventos com fotoUrl/imagemUrl = essa url──► API
visitante ──GET /api/imagens/<uuid>.<ext> (público)──► API lê do S3 e devolve a imagem
```

| Rota | Acesso | Resposta |
|---|---|---|
| `POST /api/imagens` | ADMIN e VOLUNTARIO | `201 { "url": "/api/imagens/<uuid>.<ext>" }` (também no header `Location`) |
| `GET /api/imagens/:arquivo` | público | a imagem, com cache de 1 ano |

`fotoUrl` e `imagemUrl` continuam aceitando URL `http(s)` externa, e agora também o caminho
interno `/api/imagens/<uuid>.<jpg|png|webp>`. Os limites de tamanho continuam (191 e 500
caracteres).

## Validações e limites

| Regra | Erro |
|---|---|
| Sem token / perfil sem permissão | 401 / 403 |
| Upload desabilitado (ex.: produção sem `S3_BUCKET`) | 503 `O envio de imagens não está disponível no momento...` |
| Nenhum arquivo no campo `arquivo` | 400 |
| Mais de um arquivo, campo com outro nome, campos extras demais, multipart malformado | 400 |
| Arquivo acima de **5 MB** (multer, em memória) | 413 `A imagem deve ter no máximo 5 MB.` |
| Tipo diferente de **JPEG, PNG ou WebP**, conferido pelos *magic bytes* do conteúdo (nome e `Content-Type` enviados são ignorados). SVG, GIF, HEIC, PDF etc. são recusados | 415 `Formato não suportado...` |
| Começa como imagem mas não decodifica (corrompido ou disfarçado) | 415 |
| Mais de **50 megapixels** declarados no cabeçalho (imagem-bomba), recusada antes de decodificar | 413 |
| Mais de **30 envios por usuário a cada 15 min** | 429 |
| `GET`: mais de **300 leituras por IP por minuto** (folgado de propósito: uma listagem carrega dezenas de fotos de uma vez e redes compartilhadas, como o abrigo, a faculdade ou NAT de operadora, juntam vários visitantes num IP; com o cache de 1 ano no navegador, quem volta nem chega à API. Serve para frear abuso que geraria leituras no S3) | 429 `Muitas requisições de imagens...` |

O que acontece com uma imagem aceita (`sharp`):

- é decodificada e gravada de novo no mesmo formato. Isso remove EXIF (inclusive a
  **localização GPS** da foto), comentários e qualquer conteúdo escondido no arquivo;
- a rotação do EXIF é aplicada antes, para a foto não ficar deitada;
- o maior lado fica com no máximo **1600 px** (imagens menores não são ampliadas);
- em WebP animado, fica só o primeiro quadro;
- o nome é um UUID aleatório e a extensão vem do tipo detectado. O nome enviado nunca é usado.

`GET /api/imagens/:arquivo`:

- o nome precisa bater com `^[0-9a-f-]{36}\.(jpg|png|webp)$`; qualquer outro valor (`..`,
  barras, maiúsculas, outra extensão) dá 400 sem consultar o armazenamento;
- 404 `Imagem não encontrada.` se não existir;
- headers: `Content-Type` pela extensão, `X-Content-Type-Options: nosniff`,
  `Cache-Control: public, max-age=31536000, immutable` e
  `Cross-Origin-Resource-Policy: cross-origin`. Só esta rota libera o CORP (o helmet manda
  `same-origin` no resto), para o frontend em outra origem (ex.: `localhost:5173` no
  desenvolvimento) conseguir exibir a imagem.

Em produção, o Caddy também recusa corpos acima de 6 MB em `/api/imagens*` (`deploy/Caddyfile`).

## Limpeza das imagens antigas

Quando a imagem deixa de ser usada, o arquivo é apagado do armazenamento
(`src/storage/limparImagem.ts`, chamado pelos services de animal e evento):

| Situação | O que acontece |
|---|---|
| `PUT` com `fotoUrl`/`imagemUrl` trocada ou `null` | a antiga é apagada **depois** que o update no banco deu certo |
| `PUT` com o mesmo valor, ou sem o campo | nada é apagado |
| `DELETE` do animal/evento | a imagem dele é apagada depois do delete no banco |
| Valor antigo é URL externa ou fora do formato `/api/imagens/<uuid>.<jpg\|png\|webp>` | nada é apagado (só apagamos imagens nossas) |
| Outro animal ou evento ainda usa a mesma imagem | nada é apagado |
| Update/delete falhou no banco | nada é apagado |
| Falha ao apagar (S3 fora, banco indisponível na conferência) | a requisição continua com sucesso e a resposta não muda; o log mostra `[armazenamento] Falha ao remover a imagem uploads/<arquivo>: <tipo do erro>` (sem mensagem do erro, bucket ou dados do registro) e o arquivo fica órfão |

A conferência de "ainda em uso" consulta todas as colunas de imagem (`Animal.fotoUrl` e
`Evento.imagemUrl`). Ao criar outro campo de imagem no schema, inclua-o em `imagemEmUso`.
Imagens enviadas pelo `POST /api/imagens` e nunca gravadas em nenhum registro não são
apagadas automaticamente.

## Código

| Arquivo | Papel |
|---|---|
| `src/storage/armazenamento.ts` | Interface: `salvar`, `ler` e `remover` por chave |
| `src/storage/s3.ts` | Driver S3 (`@aws-sdk/client-s3`, credenciais pela cadeia padrão) |
| `src/storage/local.ts` | Driver da pasta `./uploads` (**só desenvolvimento**) |
| `src/storage/config.ts` | Escolhe o driver a partir de `STORAGE_DRIVER`, `S3_BUCKET` e `AWS_REGION` |
| `src/storage/chaves.ts` | Formato do nome, da chave (`uploads/...`) e da URL; `chaveDaUrlInterna` converte o valor gravado na chave |
| `src/storage/limparImagem.ts` | Apaga a imagem antiga quando ninguém mais a usa (nunca lança) |
| `src/middleware/uploadImagem.ts` | multer (`memoryStorage`, limites) e tradução dos erros |
| `src/service/imagemService.ts` | Magic bytes, reencode, gravação e leitura |
| `src/routes/imagemRoutes.ts` | Rotas e ordem dos middlewares |

## Configuração

| Variável | Valores |
|---|---|
| `STORAGE_DRIVER` | `local` ou `s3`. Padrão: `s3` em produção, `local` fora dela. Em produção, `local` é recusado |
| `S3_BUCKET` | Nome do bucket. Sem ele (com `s3`), a API sobe e o upload responde 503 |
| `AWS_REGION` | Região do bucket (padrão `sa-east-1`) |

Configuração incompleta ou inválida nunca derruba a API: aparece no log de inicialização
`[config] Upload de imagens desabilitado: <motivo>` e as rotas de imagem respondem 503.

## Testar localmente

Com `npm run dev` (sem `NODE_ENV=production`), o padrão é a pasta `./uploads` (no `.gitignore`).

```bash
# token de um usuário ADMIN ou VOLUNTARIO
TOKEN=$(curl -s localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@exemplo.org","senha":"<senha>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

curl -i localhost:4000/api/imagens -H "Authorization: Bearer $TOKEN" -F arquivo=@foto.jpg
# 201 {"url":"/api/imagens/<uuid>.jpg"}

curl -I localhost:4000/api/imagens/<uuid>.jpg            # 200, image/jpeg, cache e CORP
curl -i localhost:4000/api/imagens -H "Authorization: Bearer $TOKEN" -F arquivo=@desenho.svg   # 415
```

Os testes automáticos (`src/__tests__/routes/imagens.routes.test.ts` e
`src/__tests__/storage/armazenamento.test.ts`) usam um armazenamento em memória e um cliente
S3 falso: não gravam em disco (exceto numa pasta temporária no teste do driver local) nem
acessam a rede.

## Produção

Pré-requisitos (infra na branch do S3, `infra/armazenamento.tf`):

1. `terraform apply` criou o bucket, a permissão da role em `uploads/*` e o parâmetro
   `/anjos/s3_bucket`.
2. A EC2 está com `http_put_response_hop_limit = 2`. Sem isso, o container da API não alcança
   as credenciais da role e o upload falha com 500 (`Could not load credentials`).
3. O `deploy/deploy.sh` lê `/anjos/s3_bucket` (opcional) e grava `AWS_REGION` e `S3_BUCKET`
   no `/opt/anjos/.env`. Nenhuma chave de acesso vai para o `.env`.

Validar depois do deploy (sessão do SSM na EC2, `sudo -i`, `cd /opt/anjos`):

```bash
grep -E '^(S3_BUCKET|AWS_REGION)=' .env        # bucket e região preenchidos (não são segredos)
docker compose -f docker-compose.prod.yml logs api | grep -i "upload de imagens desabilitado"   # não deve aparecer
```

Pela internet:

```bash
curl -i https://abrigoanjosprotetores.com.br/api/imagens \
  -H "Authorization: Bearer $TOKEN" -F arquivo=@foto.jpg                      # 201 {"url":...}
curl -I https://abrigoanjosprotetores.com.br/api/imagens/<uuid>.jpg            # 200
aws s3 ls s3://<bucket>/uploads/                                               # o arquivo está lá
curl -I https://<bucket>.s3.sa-east-1.amazonaws.com/uploads/<uuid>.jpg         # 403: o bucket não é público
```

Se o upload der 503, falta `S3_BUCKET` no `.env` (parâmetro ou apply ausente). Se der 500,
veja `docker compose logs api`: em geral é o hop limit ou a permissão da role.

## Limitações conhecidas

- Uma imagem enviada pelo upload e nunca usada num registro (ex.: formulário abandonado)
  continua no bucket.
- As imagens passam pela API (não há CDN nem URL pré-assinada). Para o volume do abrigo é
  suficiente, e o cache de 1 ano no navegador evita downloads repetidos.
