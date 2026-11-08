import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REGIAO_PADRAO, resolverConfigArmazenamento } from "../../storage/config";
import { ArmazenamentoLocal } from "../../storage/local";
import { ArmazenamentoS3 } from "../../storage/s3";
import {
    MENSAGEM_INDISPONIVEL,
    criarArmazenamento,
    definirArmazenamento,
    exigirArmazenamento,
    obterArmazenamento,
} from "../../storage";
import { esperarAppError } from "../helpers/erros";
import { ArmazenamentoMemoria } from "../helpers/armazenamento";

describe("resolverConfigArmazenamento", () => {
    it("fora de produção, o padrão é a pasta ./uploads", () => {
        expect(resolverConfigArmazenamento({ NODE_ENV: "development" })).toEqual({
            driver: "local",
            pasta: path.resolve("uploads"),
        });
        expect(resolverConfigArmazenamento({ STORAGE_DRIVER: " LOCAL " })).toMatchObject({ driver: "local" });
    });

    it("em produção, o padrão é o S3, com a região informada ou sa-east-1", () => {
        expect(resolverConfigArmazenamento({ NODE_ENV: "production", S3_BUCKET: " anjos-uploads ", AWS_REGION: "us-east-1" })).toEqual({
            driver: "s3",
            bucket: "anjos-uploads",
            regiao: "us-east-1",
        });
        expect(resolverConfigArmazenamento({ NODE_ENV: "production", S3_BUCKET: "b", AWS_REGION: " " })).toEqual({
            driver: "s3",
            bucket: "b",
            regiao: REGIAO_PADRAO,
        });
        expect(resolverConfigArmazenamento({ STORAGE_DRIVER: "s3", S3_BUCKET: "b" })).toMatchObject({ driver: "s3" });
    });

    it("produção sem S3_BUCKET: desabilitado (a API sobe e o upload responde 503)", () => {
        expect(resolverConfigArmazenamento({ NODE_ENV: "production" })).toEqual({
            driver: "desabilitado",
            motivo: "S3_BUCKET não está definida.",
        });
        expect(resolverConfigArmazenamento({ NODE_ENV: "production", STORAGE_DRIVER: "s3", S3_BUCKET: "  " })).toMatchObject({
            driver: "desabilitado",
        });
    });

    it("produção nunca usa o disco local", () => {
        expect(resolverConfigArmazenamento({ NODE_ENV: "production", STORAGE_DRIVER: "local", S3_BUCKET: "b" })).toEqual({
            driver: "desabilitado",
            motivo: "STORAGE_DRIVER=local não é permitido em produção (use s3).",
        });
    });

    it("STORAGE_DRIVER inválido desabilita o upload sem derrubar a API", () => {
        expect(resolverConfigArmazenamento({ STORAGE_DRIVER: "disco", S3_BUCKET: "b" })).toEqual({
            driver: "desabilitado",
            motivo: 'STORAGE_DRIVER inválido: "disco". Use "local" ou "s3".',
        });
    });
});

describe("criarArmazenamento, obterArmazenamento e exigirArmazenamento", () => {
    afterEach(() => definirArmazenamento(new ArmazenamentoMemoria()));

    it("cria o driver de cada configuração (sem acessar disco nem rede)", () => {
        expect(criarArmazenamento({ driver: "s3", bucket: "b", regiao: "sa-east-1" })).toBeInstanceOf(ArmazenamentoS3);
        expect(criarArmazenamento({ driver: "local", pasta: "uploads" })).toBeInstanceOf(ArmazenamentoLocal);
        expect(criarArmazenamento({ driver: "desabilitado", motivo: "x" })).toBeNull();
    });

    it("sem nada definido, usa a configuração do ambiente (local nos testes) e reaproveita a instância", () => {
        definirArmazenamento(undefined);
        const primeiro = obterArmazenamento();
        expect(primeiro).toBeInstanceOf(ArmazenamentoLocal);
        expect(obterArmazenamento()).toBe(primeiro);
    });

    it("exigirArmazenamento dá 503 quando o upload está desabilitado", async () => {
        definirArmazenamento(null);
        await esperarAppError(Promise.resolve().then(() => exigirArmazenamento()), 503, MENSAGEM_INDISPONIVEL);
        const memoria = new ArmazenamentoMemoria();
        definirArmazenamento(memoria);
        expect(exigirArmazenamento()).toBe(memoria);
    });
});

describe("ArmazenamentoLocal (somente desenvolvimento)", () => {
    let pasta: string;
    let local: ArmazenamentoLocal;

    beforeEach(async () => {
        pasta = await mkdtemp(path.join(tmpdir(), "anjos-uploads-"));
        local = new ArmazenamentoLocal(pasta);
    });

    afterEach(async () => {
        await rm(pasta, { recursive: true, force: true });
    });

    it("salva, lê e remove por chave (criando as subpastas)", async () => {
        await local.salvar("uploads/a.png", Buffer.from("conteudo"));
        expect((await local.ler("uploads/a.png"))?.toString()).toBe("conteudo");

        await local.remover("uploads/a.png");
        expect(await local.ler("uploads/a.png")).toBeNull();
        // remover de novo não falha
        await expect(local.remover("uploads/a.png")).resolves.toBeUndefined();
    });

    it.each(["../fora.png", "uploads/../../fora.png", path.resolve("/etc/passwd"), ""])(
        "recusa chave fora da pasta: %s",
        async (chave) => {
            await expect(local.salvar(chave, Buffer.from("x"))).rejects.toThrow("fora da pasta de uploads");
            await expect(local.ler(chave)).rejects.toThrow("fora da pasta de uploads");
            await expect(local.remover(chave)).rejects.toThrow("fora da pasta de uploads");
        },
    );

    it("repassa erros de leitura que não sejam arquivo inexistente", async () => {
        await mkdir(path.join(pasta, "uploads", "pasta.png"), { recursive: true });
        await expect(local.ler("uploads/pasta.png")).rejects.toMatchObject({ code: expect.stringMatching(/EISDIR|EPERM|EACCES/) });
    });
});

describe("ArmazenamentoS3 (cliente falso, sem rede)", () => {
    function criar(resposta: () => Promise<unknown>) {
        const send = vi.fn<(comando: unknown) => Promise<unknown>>(resposta);
        const s3 = new ArmazenamentoS3("anjos-uploads-teste", { send } as unknown as S3Client);
        return { s3, send };
    }

    const erroS3 = (status: number, nome: string) => Object.assign(new Error(nome), { name: nome, $metadata: { httpStatusCode: status } });

    it("salva com tipo e cache, sem ACL pública", async () => {
        const { s3, send } = criar(async () => ({}));
        await s3.salvar("uploads/a.webp", Buffer.from("img"), "image/webp");

        const comando = send.mock.calls[0]?.[0] as PutObjectCommand;
        expect(comando).toBeInstanceOf(PutObjectCommand);
        expect(comando.input).toEqual({
            Bucket: "anjos-uploads-teste",
            Key: "uploads/a.webp",
            Body: Buffer.from("img"),
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
        });
    });

    it("lê o conteúdo do objeto", async () => {
        const { s3, send } = criar(async () => ({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }));
        expect(await s3.ler("uploads/a.jpg")).toEqual(Buffer.from([1, 2, 3]));
        const comando = send.mock.calls[0]?.[0] as GetObjectCommand;
        expect(comando).toBeInstanceOf(GetObjectCommand);
        expect(comando.input).toEqual({ Bucket: "anjos-uploads-teste", Key: "uploads/a.jpg" });
    });

    it("objeto sem corpo ou inexistente (404) devolve null", async () => {
        expect(await criar(async () => ({})).s3.ler("uploads/a.jpg")).toBeNull();
        const naoExiste = new NoSuchKey({ message: "não existe", $metadata: { httpStatusCode: 404 } });
        expect(
            await criar(async () => {
                throw naoExiste;
            }).s3.ler("uploads/a.jpg"),
        ).toBeNull();
    });

    // Com ListBucket na role, chave inexistente é 404. Um 403 é falta de permissão de verdade.
    it("403 (permissão negada) é repassado, não vira imagem inexistente", async () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const { s3 } = criar(async () => {
            throw erroS3(403, "AccessDenied");
        });
        await expect(s3.ler("uploads/a.jpg")).rejects.toMatchObject({
            name: "AccessDenied",
            $metadata: { httpStatusCode: 403 },
        });
        expect(aviso).not.toHaveBeenCalled();
    });

    it("repassa outros erros do S3 (500, sem status, sem rede)", async () => {
        const { s3 } = criar(async () => {
            throw erroS3(500, "InternalError");
        });
        await expect(s3.ler("uploads/a.jpg")).rejects.toThrow("InternalError");
        await expect(
            criar(async () => {
                throw new Error("sem rede");
            }).s3.ler("uploads/a.jpg"),
        ).rejects.toThrow("sem rede");
    });

    it("remove o objeto", async () => {
        const { s3, send } = criar(async () => ({}));
        await s3.remover("uploads/a.png");
        const comando = send.mock.calls[0]?.[0] as DeleteObjectCommand;
        expect(comando).toBeInstanceOf(DeleteObjectCommand);
        expect(comando.input).toEqual({ Bucket: "anjos-uploads-teste", Key: "uploads/a.png" });
    });

    it("repassa erro ao remover (quem trata é o storage/limparImagem.ts)", async () => {
        const { s3 } = criar(async () => {
            throw erroS3(503, "ServiceUnavailable");
        });
        await expect(s3.remover("uploads/a.png")).rejects.toThrow("ServiceUnavailable");
    });

    it("ArmazenamentoS3.criar monta o cliente na região informada (credenciais pela cadeia padrão)", async () => {
        const s3 = ArmazenamentoS3.criar("b", "sa-east-1");
        const cliente = (s3 as unknown as { cliente: S3Client }).cliente;
        expect(cliente).toBeInstanceOf(S3Client);
        expect(await cliente.config.region()).toBe("sa-east-1");
    });
});
