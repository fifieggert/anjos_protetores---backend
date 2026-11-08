import { beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDaUrlInterna } from "../../storage/chaves";
import { removerImagemSeOrfa, removerImagemSubstituida } from "../../storage/limparImagem";
import { definirArmazenamento } from "../../storage";
import { ArmazenamentoMemoria } from "../helpers/armazenamento";
import { erroPrisma } from "../helpers/erros";
import { prismaMock } from "../helpers/prisma";

const ARQUIVO = "0f8fad5b-d9cb-469f-a165-70867728950e.webp";
const URL_INTERNA = `/api/imagens/${ARQUIVO}`;
const CHAVE = `uploads/${ARQUIVO}`;

let memoria: ArmazenamentoMemoria;

beforeEach(async () => {
    memoria = new ArmazenamentoMemoria();
    definirArmazenamento(memoria);
    await memoria.salvar(CHAVE, Buffer.from("img"), "image/webp");
    prismaMock.animal.count.mockResolvedValue(0);
    prismaMock.evento.count.mockResolvedValue(0);
});

describe("chaveDaUrlInterna", () => {
    it("converte o caminho interno na chave do armazenamento", () => {
        expect(chaveDaUrlInterna(URL_INTERNA)).toBe(CHAVE);
        expect(chaveDaUrlInterna("/api/imagens/0f8fad5b-d9cb-469f-a165-70867728950e.jpg")).toBe(
            "uploads/0f8fad5b-d9cb-469f-a165-70867728950e.jpg",
        );
    });

    it.each([
        null,
        undefined,
        "",
        "https://exemplo.org/foto.jpg",
        `https://exemplo.org${URL_INTERNA}`,
        `/api/imagens/../${ARQUIVO}`,
        "/api/imagens/../../etc/passwd",
        `/api/imagens/${ARQUIVO.toUpperCase()}`,
        "/api/imagens/0f8fad5b-d9cb-469f-a165-70867728950e.gif",
        `/api/imagens/${ARQUIVO}/x`,
        `/outra/${ARQUIVO}`,
        ARQUIVO,
    ])("devolve null para valor que não é imagem nossa: %s", (valor) => {
        expect(chaveDaUrlInterna(valor)).toBeNull();
    });
});

describe("removerImagemSeOrfa", () => {
    it("apaga a imagem interna que ninguém mais usa", async () => {
        await removerImagemSeOrfa(URL_INTERNA);
        expect(memoria.arquivos.has(CHAVE)).toBe(false);
        expect(prismaMock.animal.count).toHaveBeenCalledWith({ where: { fotoUrl: URL_INTERNA } });
        expect(prismaMock.evento.count).toHaveBeenCalledWith({ where: { imagemUrl: URL_INTERNA } });
    });

    it.each([null, undefined, "", "https://exemplo.org/foto.jpg", "/api/imagens/../segredo"])(
        "não apaga nem consulta o banco para %s",
        async (valor) => {
            const remover = vi.spyOn(memoria, "remover");
            await removerImagemSeOrfa(valor);
            expect(remover).not.toHaveBeenCalled();
            expect(prismaMock.animal.count).not.toHaveBeenCalled();
        },
    );

    it.each([
        ["outro animal", 1, 0],
        ["um evento", 0, 1],
    ])("não apaga imagem ainda usada por %s", async (_quem, animais, eventos) => {
        prismaMock.animal.count.mockResolvedValue(animais);
        prismaMock.evento.count.mockResolvedValue(eventos);
        await removerImagemSeOrfa(URL_INTERNA);
        expect(memoria.arquivos.has(CHAVE)).toBe(true);
    });

    it("falha do armazenamento não lança: registra só o tipo do erro e o status", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const erro = Object.assign(new Error("bucket anjos-uploads-segredo em sa-east-1"), {
            name: "ServiceUnavailable",
            $metadata: { httpStatusCode: 503 },
        });
        vi.spyOn(memoria, "remover").mockRejectedValue(erro);

        await expect(removerImagemSeOrfa(URL_INTERNA)).resolves.toBeUndefined();

        expect(log).toHaveBeenCalledTimes(1);
        const mensagem = String(log.mock.calls[0]?.[0]);
        expect(mensagem).toBe(`[armazenamento] Falha ao remover a imagem ${CHAVE}: ServiceUnavailable (HTTP 503)`);
        expect(mensagem).not.toContain("segredo");
    });

    it("falha na conferência do banco não lança e não apaga", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        prismaMock.evento.count.mockRejectedValue(erroPrisma("P1001"));

        await expect(removerImagemSeOrfa(URL_INTERNA)).resolves.toBeUndefined();

        expect(memoria.arquivos.has(CHAVE)).toBe(true);
        expect(String(log.mock.calls[0]?.[0])).toBe(
            `[armazenamento] Falha ao remover a imagem ${CHAVE}: PrismaClientKnownRequestError`,
        );
        expect(String(log.mock.calls[0]?.[0])).not.toContain("dados internos");
    });

    it("erro que não é Error também é só registrado", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(memoria, "remover").mockRejectedValue("texto");
        await removerImagemSeOrfa(URL_INTERNA);
        expect(String(log.mock.calls[0]?.[0])).toContain("erro desconhecido");
    });

    it("armazenamento desabilitado: só avisa no log", async () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        definirArmazenamento(null);
        await expect(removerImagemSeOrfa(URL_INTERNA)).resolves.toBeUndefined();
        expect(aviso).toHaveBeenCalledWith(`[armazenamento] Imagem ${CHAVE} não removida: armazenamento desabilitado.`);
    });
});

describe("removerImagemSubstituida", () => {
    it("campo não enviado ou com o mesmo valor: não apaga", async () => {
        await removerImagemSubstituida(URL_INTERNA, undefined);
        await removerImagemSubstituida(URL_INTERNA, URL_INTERNA);
        expect(memoria.arquivos.has(CHAVE)).toBe(true);
        expect(prismaMock.animal.count).not.toHaveBeenCalled();
    });

    it("trocada por outra imagem ou por null: apaga a antiga", async () => {
        await removerImagemSubstituida(URL_INTERNA, "https://exemplo.org/nova.jpg");
        expect(memoria.arquivos.has(CHAVE)).toBe(false);

        await memoria.salvar(CHAVE, Buffer.from("img"), "image/webp");
        await removerImagemSubstituida(URL_INTERNA, null);
        expect(memoria.arquivos.has(CHAVE)).toBe(false);
    });

    it("antiga nula ou externa: nada a apagar", async () => {
        const remover = vi.spyOn(memoria, "remover");
        await removerImagemSubstituida(null, URL_INTERNA);
        await removerImagemSubstituida("https://exemplo.org/velha.jpg", null);
        expect(remover).not.toHaveBeenCalled();
    });
});
