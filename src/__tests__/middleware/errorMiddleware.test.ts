import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { rotaNaoEncontrada, tratarErros } from "../../middleware/errorMiddleware";
import { AppError } from "../../utils/AppError";
import { erroPrisma } from "../helpers/erros";
import { proximo, requisicao, resposta } from "../helpers/express";

function tratar(erro: unknown) {
    const res = resposta();
    tratarErros(erro, requisicao(), res, proximo());
    return res;
}

describe("tratarErros", () => {
    it("AppError devolve status e mensagem como estão", () => {
        const res = tratar(new AppError(409, "Conflito de regra."));
        expect(res.statusCode).toBe(409);
        expect(res.corpo).toEqual({ error: "Conflito de regra." });
    });

    it("AppError com campos devolve os campos (formato da validação)", () => {
        const res = tratar(new AppError(400, "Dados inválidos.", { horarioFim: "Depois do início." }));
        expect(res.statusCode).toBe(400);
        expect(res.corpo).toEqual({ error: "Dados inválidos.", campos: { horarioFim: "Depois do início." } });
    });

    it.each([
        ["P2025", 404, "Registro não encontrado."],
        ["P2003", 409, /em uso/],
        ["P2014", 409, /vinculado/],
        ["P2034", 409, /ao mesmo tempo/],
        ["P2000", 400, /tamanho permitido/],
    ])("erro do Prisma %s vira %s", (codigo, status, mensagem) => {
        const res = tratar(erroPrisma(codigo));
        expect(res.statusCode).toBe(status);
        expect((res.corpo as { error: string }).error).toMatch(mensagem);
    });

    it.each([
        [{ target: ["email"] }, "Já existe um cadastro com este e-mail."],
        [{ target: "Usuario_email_key" }, "Já existe um cadastro com este e-mail."],
        [{ target: ["cpf"] }, "Já existe um cadastro com este CPF."],
        [{ target: ["outro"] }, "Já existe um registro com este valor."],
        [undefined, "Já existe um registro com este valor."],
    ])("P2002 (unique) dá 409 com mensagem do campo %j", (meta, mensagem) => {
        const res = tratar(erroPrisma("P2002", meta));
        expect(res.statusCode).toBe(409);
        expect(res.corpo).toEqual({ error: mensagem });
    });

    it("erro do Prisma desconhecido dá 500 e o log tem só tipo e código (sem dados pessoais)", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const res = tratar(erroPrisma("P9999"));
        expect(res.statusCode).toBe(500);
        expect(res.corpo).toEqual({ error: "Erro interno do servidor." });
        expect(log).toHaveBeenCalledWith("[erro] PrismaClientKnownRequestError P9999");
        expect(JSON.stringify(log.mock.calls)).not.toContain("dados internos");
    });

    it("outros erros do Prisma (ex.: validação) registram só o nome", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const erro = new Prisma.PrismaClientValidationError("telefone 47999998888 inválido", { clientVersion: "teste" });
        expect(tratar(erro).statusCode).toBe(500);
        expect(log).toHaveBeenCalledWith("[erro] PrismaClientValidationError");
        expect(JSON.stringify(log.mock.calls)).not.toContain("47999998888");
    });

    it.each([
        ["entity.parse.failed", 400, "JSON inválido no corpo da requisição."],
        ["entity.too.large", 413, "O corpo da requisição é grande demais."],
        ["encoding.unsupported", 415, "Codificação do corpo da requisição não suportada."],
        ["charset.unsupported", 415, "Codificação do corpo da requisição não suportada."],
    ])("erro do express.json %s vira %s", (type, status, mensagem) => {
        const res = tratar(Object.assign(new Error("x"), { type }));
        expect(res.statusCode).toBe(status);
        expect(res.corpo).toEqual({ error: mensagem });
    });

    it.each([
        ["Error comum", new Error("detalhe interno com stack")],
        ["erro do body-parser desconhecido", Object.assign(new Error("x"), { type: "outro" })],
        ["valor que não é objeto", "falhou"],
        ["null", null],
    ])("%s dá 500 sem stack nem detalhes", (_caso, erro) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const res = tratar(erro);
        expect(res.statusCode).toBe(500);
        expect(res.corpo).toEqual({ error: "Erro interno do servidor." });
    });
});

describe("rotaNaoEncontrada", () => {
    it("dá 404 no formato {error}", () => {
        const res = resposta();
        rotaNaoEncontrada(requisicao(), res);
        expect(res.statusCode).toBe(404);
        expect(res.corpo).toEqual({ error: "Rota não encontrada." });
    });
});
