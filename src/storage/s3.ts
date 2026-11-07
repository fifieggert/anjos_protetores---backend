import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Armazenamento } from "./armazenamento";

// Os nomes são aleatórios e nunca reaproveitados: o conteúdo de uma chave não muda.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

// Imagens no S3 (produção). Sem chaves de acesso no código: o SDK usa a cadeia padrão de
// credenciais, que na EC2 é a role da instância (IMDSv2).
export class ArmazenamentoS3 implements Armazenamento {
    private avisouAcessoNegado = false;

    constructor(
        private readonly bucket: string,
        private readonly cliente: S3Client,
    ) {}

    static criar(bucket: string, regiao: string) {
        return new ArmazenamentoS3(bucket, new S3Client({ region: regiao }));
    }

    async salvar(chave: string, conteudo: Buffer, tipoMime: string) {
        await this.cliente.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: chave,
                Body: conteudo,
                ContentType: tipoMime,
                CacheControl: CACHE_CONTROL,
            }),
        );
    }

    async ler(chave: string) {
        try {
            const resposta = await this.cliente.send(new GetObjectCommand({ Bucket: this.bucket, Key: chave }));
            if (!resposta.Body) return null;
            return Buffer.from(await resposta.Body.transformToByteArray());
        } catch (erro) {
            const status = (erro as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
            if (status === 404) return null;
            // A role só pode listar o prefixo uploads/ (condição s3:prefix). Para uma chave que
            // não existe, o S3 então responde 403 em vez de 404: tratamos como inexistente.
            // Um 403 por falta de permissão real aparece no upload (PutObject), que falha com 500.
            if (status === 403) {
                if (!this.avisouAcessoNegado) {
                    this.avisouAcessoNegado = true;
                    console.warn("[armazenamento] S3 respondeu 403 ao ler uma imagem; tratado como inexistente. Se todas as imagens derem 404, confira a role da EC2.");
                }
                return null;
            }
            throw erro;
        }
    }

    async remover(chave: string) {
        await this.cliente.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: chave }));
    }
}
