# Infraestrutura na AWS (Terraform)

Infraestrutura do Anjos Protetores na AWS, região **sa-east-1 (São Paulo)**, descrita como
código com Terraform. Todo recurso tem um comentário explicando por que existe.

> Projeto acadêmico (TCC): o banco pode ser apagado pelo `terraform destroy` e não guarda
> snapshot final. Em produção de verdade, isso seria diferente (ver `banco.tf`).

## O que é criado

```
                 Internet
                    │  80/443 (sem porta 22)
        ┌───────────▼─────────────── VPC 10.0.0.0/16 ──────────────┐
        │  Subnets públicas (2 AZs)        Subnets privadas (2 AZs) │
        │  ┌──────────────────────┐        ┌──────────────────────┐ │
        │  │ EC2 t3.micro         │ 3306   │ RDS MySQL 8.4        │ │
        │  │ Docker + compose     ├───TLS─►│ db.t4g.micro         │ │
        │  │ Elastic IP (fixo)    │        │ sem acesso público   │ │
        │  └──────────────────────┘        └──────────────────────┘ │
        └───────────────────────────────────────────────────────────┘
   GitHub Actions ──OIDC──► role github-actions-deploy ──► ECR (push) + SSM (deploy na EC2)
   EC2 (container api) ──role via IMDSv2──► S3 anjos-uploads-<conta> (privado, só uploads/*)
```

| Arquivo | Conteúdo |
|---|---|
| `versions.tf` | Versões do Terraform e dos providers, tags padrão |
| `variables.tf` | Variáveis de entrada |
| `rede.tf` | VPC, 2 subnets públicas, 2 privadas, internet gateway, rotas, security groups |
| `compute.tf` | EC2 (Amazon Linux 2023), role/instance profile, Elastic IP |
| `user_data.sh` | Script do primeiro boot: Docker, docker compose, `/opt/anjos`, CA do RDS |
| `ecr.tf` | Repositórios `anjos-backend` e `anjos-frontend` |
| `banco.tf` | RDS MySQL, subnet group, parameter group (utf8mb4 + TLS obrigatório) |
| `segredos.tf` | Senha do banco, `JWT_SECRET` e `DATABASE_URL` no SSM Parameter Store |
| `github_oidc.tf` | Provedor OIDC do GitHub e role de deploy |
| `armazenamento.tf` | Bucket S3 privado dos uploads de imagens, permissão da EC2 em `uploads/*`, parâmetro `/anjos/s3_bucket` |
| `outputs.tf` | IP, endpoints, URLs do ECR, ARN da role, comando do SSM |

Decisões de segurança, resumidas:

- **Sem SSH**: nenhuma porta 22 aberta e nenhuma chave SSH. O acesso ao servidor é pelo
  **SSM Session Manager**, autenticado pelo IAM e registrado no CloudTrail.
- **Banco isolado**: subnets privadas, sem IP público, porta 3306 aceita só do SG da EC2.
- **TLS obrigatório no banco** (`require_secure_transport=1`).
- **Criptografia em repouso**: disco da EC2, disco do RDS e backups.
- **IMDSv2 obrigatório** na EC2 (protege as credenciais da role contra SSRF), com hop limit 2
  para o container da API usar a role (ver *Upload de imagens (S3)*).
- **Bucket de uploads privado**: Block Public Access nas 4 opções, sem ACLs, só HTTPS.
- **Sem chaves de acesso fixas**: a EC2 usa role; o GitHub Actions usa OIDC (credenciais de 1 h),
  e só a branch `main` dos dois repositórios pode assumir a role.
- **Segredos fora do Git**: gerados pelo Terraform e guardados como `SecureString` no SSM.
- **Sem NAT Gateway** (~US$ 40/mês): o banco não precisa de internet.

## Pré-requisitos

1. [Terraform](https://developer.hashicorp.com/terraform/install) 1.9 ou mais novo.
2. [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
   configurada com um usuário/perfil com permissão de administrador na conta
   (`aws configure` ou `aws sso login`). Confira com `aws sts get-caller-identity`.
3. Para abrir terminal na EC2: o
   [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html).

## Passo a passo

Todos os comandos rodam dentro da pasta `infra/`.

### 1. Variáveis

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edite `terraform.tfvars` e confira `github_repo_backend` e `github_repo_frontend`
(formato `dono/repo`). O `terraform.tfvars` não vai para o Git.

### 2. init

Baixa os providers e cria o `.terraform.lock.hcl` (esse arquivo **vai** para o Git, para
todos usarem as mesmas versões).

```bash
terraform init
```

### 3. plan

Mostra o que será criado, sem criar nada. Leia com atenção: numa conta vazia devem aparecer
46 recursos para criar e nenhum para destruir. (Se a infraestrutura já existe e você só está
adicionando o S3, veja *Upload de imagens (S3)*.)

```bash
terraform plan -out=tfplan
```

### 4. apply

Cria tudo. Leva uns 10–15 minutos (o RDS é o mais demorado).

```bash
terraform apply tfplan
```

No fim aparecem os outputs. Para ver de novo depois: `terraform output`.

### 5. DNS no Registro.br

No painel do domínio `abrigoanjosprotetores.com.br`, crie registros **A** apontando para o
`elastic_ip` (o output `registro_dns` mostra exatamente quais). A propagação pode levar
algumas horas.

### 6. Conferir a EC2

```bash
# comando pronto no output comando_ssm_sessao
aws ssm start-session --target <instance_id> --region sa-east-1

# dentro da sessão:
docker --version && docker compose version
ls -l /opt/anjos /opt/anjos/certs
sudo cat /var/log/cloud-init-output.log   # log do user_data, se algo falhar
```

A EC2 leva 2–3 minutos depois do apply para aparecer no SSM e terminar o `user_data`.

### 7. GitHub Actions

Nos dois repositórios, o workflow de deploy usa a role pelo OIDC:

```yaml
permissions:
  id-token: write   # necessário para o GitHub emitir o token OIDC
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@<sha> # fixe por SHA, como no ci.yml
    with:
      role-to-assume: <output github_actions_role_arn>
      aws-region: sa-east-1
```

A role só aceita execuções da branch `main`. Se o job usar `environment:`, o GitHub muda o
formato do token e a trust policy em `github_oidc.tf` precisa ser ajustada.

#### IDs do GitHub no claim `sub`

O token que o GitHub envia tem um campo `sub` que diz de onde a execução veio, e é ele que a
trust policy confere. O GitHub passou a colocar nesse campo os **IDs imutáveis** do dono e do
repositório, porque um nome pode mudar ou ser reaproveitado, mas o ID não. Por isso a role
aceita os dois formatos, para cada repositório:

```
repo:<dono>@<id_dono>/<repo>@<id_repo>:ref:refs/heads/main   # novo
repo:<dono>/<repo>:ref:refs/heads/main                       # antigo (compatibilidade)
```

Os IDs ficam em `variables.tf` (`github_owner_id`, `github_repo_id_backend` e
`github_repo_id_frontend`) e não são segredos. Para descobri-los:

```bash
gh api repos/<dono>/<repo> --jq .owner.id   # ID do dono
gh api repos/<dono>/<repo> --jq .id         # ID do repositório
```

Se o repositório for recriado, o ID muda; se for renomeado, o nome no `sub` muda. Nos dois
casos, atualize as variáveis e rode o `terraform apply`.

## Conexão com o banco (TLS)

O banco recusa conexões sem TLS. A `DATABASE_URL` guardada em `/anjos/database_url` já vem
pronta:

```
mysql://anjos:<senha-url-encoded>@<endpoint-rds>:3306/anjos_protetores?ssl=true&sslaccept=strict&sslcert=/certs/rds-ca.pem
```

- `sslaccept=strict` e `sslcert` ligam e validam o TLS no `prisma migrate deploy` e também
  na API: `src/utils/conexaoBanco.ts` lê o arquivo de `sslcert` e passa ao driver MariaDB.
- `ssl=true` é mantido por compatibilidade (o `migrate deploy` o ignora).
- O certificado da AWS fica na EC2 em `/opt/anjos/certs/rds-ca.pem` (baixado pelo `user_data`).

Para isso funcionar, o container da API (e o das migrations) precisa, no docker-compose de
produção:

```yaml
    volumes:
      - /opt/anjos/certs:/certs:ro
    environment:
      # o Node não conhece a CA do RDS por padrão; sem isto a API falha com
      # "self-signed certificate in certificate chain"
      NODE_EXTRA_CA_CERTS: /certs/rds-ca.pem
```

Valide na primeira subida: `GET /health/ready` deve responder `200` e o
`npm run migrate:deploy` deve terminar sem erro.

## Segredos

| Parâmetro (SSM) | Conteúdo |
|---|---|
| `/anjos/db_password` | Senha do usuário `anjos` do MySQL |
| `/anjos/jwt_secret` | `JWT_SECRET` da API (64 caracteres) |
| `/anjos/database_url` | `DATABASE_URL` completa, com TLS |
| `/anjos/s3_bucket` | Nome do bucket de uploads (tipo `String`, **não** é segredo) |

Ler um valor (com o seu usuário da AWS ou na EC2):

```bash
aws ssm get-parameter --name /anjos/jwt_secret --with-decryption --query Parameter.Value --output text
```

**O `terraform.tfstate` contém esses segredos em texto puro.** Ele está no `.gitignore`:
nunca envie para o Git nem compartilhe. O mesmo vale para o arquivo `tfplan`.

## destroy

Apaga **tudo**, inclusive o banco (sem snapshot final), as imagens do ECR e **todas as fotos
do bucket S3** (`force_destroy = true`):

```bash
terraform destroy
```

Depois, remova os registros A no Registro.br. Se quiser guardar os dados antes, faça um dump
pela EC2 (`mysqldump` em um container) ou um snapshot manual pelo console.

## Custos estimados (sa-east-1, preço sob demanda, 730 h/mês)

Valores aproximados em dólar; confira na
[calculadora da AWS](https://calculator.aws/) antes de subir, porque os preços mudam.

| Item | Cálculo | US$/mês |
|---|---|---|
| EC2 t3.micro | ~US$ 0,0168/h | ~12 |
| RDS db.t4g.micro (MySQL, Single-AZ) | ~US$ 0,03/h | ~22 |
| Disco do RDS, 20 GB gp3 | ~US$ 0,22/GB | ~4,5 |
| Disco da EC2 (EBS), 20 GB gp3 | ~US$ 0,15/GB | ~3 |
| Elastic IP (todo IPv4 público é cobrado) | US$ 0,005/h | ~3,6 |
| Backups do RDS (até 20 GB) | grátis até o tamanho do banco | 0 |
| ECR (algumas imagens, ~1 GB) | US$ 0,10/GB | ~0,1 |
| S3 uploads (até ~5 GB de fotos + requisições) | ~US$ 0,0405/GB + ~US$ 0,007 por mil PUT | ~0,2 |
| SSM Parameter Store (padrão), KMS `aws/ssm`, OIDC, IAM | grátis | 0 |
| **Total** | | **~US$ 45/mês** (~US$ 1,50/dia) |

Não incluído: tráfego de saída para a internet acima de 100 GB/mês (~US$ 0,15/GB em
sa-east-1, irrelevante para o TCC). Contas novas podem ter créditos do Free Tier que cobrem
parte disso. Para não gastar à toa, rode `terraform destroy` quando não estiver usando.

## Upload de imagens (S3)

Fotos de animais e de eventos ficam num bucket S3 **privado** (`armazenamento.tf`).

### O que foi criado

| Recurso | Configuração |
|---|---|
| `aws_s3_bucket.uploads` | Nome `anjos-uploads-<id-da-conta>` (único no mundo), `force_destroy = true` |
| `aws_s3_bucket_public_access_block.uploads` | As 4 opções ligadas: nada pode ficar público |
| `aws_s3_bucket_ownership_controls.uploads` | `BucketOwnerEnforced`: ACLs desligadas |
| `aws_s3_bucket_server_side_encryption_configuration.uploads` | SSE-S3 (AES-256) |
| `aws_s3_bucket_versioning.uploads` | Desligado |
| `aws_s3_bucket_lifecycle_configuration.uploads` | Apaga uploads multipart incompletos após 1 dia |
| `aws_s3_bucket_policy.uploads` | Nega qualquer acesso sem HTTPS (`aws:SecureTransport = false`) |
| `aws_iam_role_policy.ec2_uploads` | Role da EC2: `PutObject`/`GetObject`/`DeleteObject` só em `uploads/*`; `ListBucket` só com prefixo `uploads/` |
| `aws_ssm_parameter.s3_bucket` | `/anjos/s3_bucket` (String) com o nome do bucket |

Sem website hosting e sem ACL pública. Para exibir uma foto, a API entrega o arquivo ou gera
uma URL pré-assinada temporária.

Outputs novos: `uploads_bucket` e `uploads_regiao`.

### IMDSv2 com hop limit 2

A API roda num container e usa o SDK da AWS com as credenciais da role da EC2 (sem chave de
acesso no `.env`). Essas credenciais vêm do serviço de metadados (IMDS). O container fica um
"salto" de rede depois do host (bridge do Docker), então o `http_put_response_hop_limit`
passou de 1 para **2**. O `http_tokens = "required"` (IMDSv2 obrigatório) continua.

- **Não recria a EC2**: a alteração é feita na hora (`ModifyInstanceMetadataOptions`), sem
  reiniciar. O `user_data`, o disco e o Elastic IP não mudam.
- **Efeito colateral**: qualquer container da máquina (`api`, `web`, `caddy`) consegue as
  credenciais da role, que leem `/anjos/*` no SSM, fazem pull no ECR e mexem em `uploads/*`.
  A role tem só o mínimo, e o IMDSv2 continua bloqueando SSRF simples (exige um `PUT` com
  cabeçalho). Se quiser endurecer depois: bloquear `169.254.169.254` para os containers
  `web`/`caddy` com uma regra `iptables` na chain `DOCKER-USER`.

### Variáveis da API

A API precisa de `S3_BUCKET` e `AWS_REGION`. Nenhuma é secreta. A menor mudança é no
`deploy/deploy.sh` (ver `docs/deploy-aws.md`): ler `/anjos/s3_bucket` do SSM e gravar as duas
no `/opt/anjos/.env`.

### Aplicar numa infraestrutura que já existe

```bash
terraform plan -out=tfplan
```

O plan deve mostrar **9 para criar, 1 para alterar, 0 para destruir**:

- criar: os 9 recursos da tabela acima;
- alterar (in-place, `~`): `aws_instance.app`, só `metadata_options.http_put_response_hop_limit: 1 -> 2`.

Se aparecer `-/+` (replace) ou `must be replaced` em `aws_instance.app`, **pare**: isso apagaria
a EC2 e rodaria o `user_data` de novo. Não deve acontecer (o `ami` está em `ignore_changes`).

```bash
terraform apply tfplan
```

### Validar depois do apply

```bash
B=$(terraform output -raw uploads_bucket)

# configurações do bucket
aws s3api get-public-access-block --bucket "$B"          # 4 x true
aws s3api get-bucket-ownership-controls --bucket "$B"    # BucketOwnerEnforced
aws s3api get-bucket-encryption --bucket "$B"            # AES256
aws s3api get-bucket-versioning --bucket "$B"            # vazio = nunca versionado
aws s3api get-bucket-lifecycle-configuration --bucket "$B"
aws s3api get-bucket-policy --bucket "$B" --query Policy --output text

# sem acesso público: deve responder 403
curl -s -o /dev/null -w "%{http_code}
" "https://$B.s3.sa-east-1.amazonaws.com/uploads/teste.txt"

# IMDS da EC2: HttpTokens=required e HttpPutResponseHopLimit=2
aws ec2 describe-instances --instance-ids "$(terraform output -raw instance_id)"   --query 'Reservations[].Instances[].MetadataOptions'
```

Na EC2 (sessão do SSM, `sudo -i`), testar a role **de dentro de um container**:

```bash
B=$(aws ssm get-parameter --name /anjos/s3_bucket --query Parameter.Value --output text)
AWS="docker run --rm -i -e AWS_REGION=sa-east-1 amazon/aws-cli"

$AWS sts get-caller-identity                              # role anjos-ec2
echo teste | $AWS s3 cp - "s3://$B/uploads/teste.txt"     # ok
$AWS s3 ls "s3://$B/uploads/"                             # lista teste.txt
$AWS s3 rm "s3://$B/uploads/teste.txt"                    # ok
echo teste | $AWS s3 cp - "s3://$B/fora.txt"              # AccessDenied (fora de uploads/)

docker rmi amazon/aws-cli                                 # libera o disco
```

### Limpar

O `terraform destroy` apaga o bucket **com todas as fotos** (`force_destroy = true`), sem
possibilidade de recuperar (o versionamento está desligado). Para guardar as fotos antes:

```bash
aws s3 sync "s3://$(terraform output -raw uploads_bucket)/uploads/" ./backup-uploads/
```

## Problemas comuns

- **`EntityAlreadyExists` no OIDC provider**: a conta já tem o provedor do GitHub (só pode
  haver um). Importe-o: `terraform import aws_iam_openid_connect_provider.github arn:aws:iam::<conta>:oidc-provider/token.actions.githubusercontent.com`.
- **`Not authorized to perform sts:AssumeRoleWithWebIdentity` no deploy**: o `sub` do token não
  bateu com a trust policy. Veja o valor recebido no CloudTrail (evento
  `AssumeRoleWithWebIdentity`) e compare com a seção *IDs do GitHub no claim `sub`*.
- **EC2 não aparece no SSM**: espere alguns minutos; confira se ela tem o Elastic IP e se o
  security group permite saída.
- **API não conecta no banco**: confira o volume `/certs` acima (e o `NODE_EXTRA_CA_CERTS`).
- **Upload falha com `Could not load credentials` / timeout no IMDS**: confira se o
  `HttpPutResponseHopLimit` da EC2 é 2. **`AccessDenied` no S3**: a chave do objeto precisa
  começar com `uploads/`.

O deploy da aplicação (GitHub Actions + SSM) está em `docs/deploy-aws.md`.
