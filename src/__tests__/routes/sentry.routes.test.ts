import type { ErrorRequestHandler } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { erroPrisma } from "../helpers/erros";

// O Sentry.setupExpressErrorHandler falso registra um middleware que guarda os erros que
// chegam até ele (no lugar de mandar para o Sentry). Nada sai para a rede.
const sentry = vi.hoisted(() => {
    const vistos: unknown[] = [];
    const middleware: ErrorRequestHandler = (erro, _req, _res, next) => {
        vistos.push(erro);
        next(erro);
    };
    return {
        vistos,
        init: vi.fn<() => void>(),
        captureMessage: vi.fn<() => void>(),
        expressIntegration: vi.fn<() => unknown>(),
        setupExpressErrorHandler: vi.fn<(app: { use: (m: unknown) => unknown }) => unknown>((app) => app.use(middleware)),
    };
});
vi.mock("@sentry/node", () => sentry);

import app from "../../app";
import { api, zerarLimites } from "../helpers/app";
import { removerDadosPessoais } from "../../instrument";

// guardado já na importação do app (o histórico dos mocks é limpo entre os testes)
const registradoEm = sentry.setupExpressErrorHandler.mock.calls.map(([alvo]) => alvo);

// O que de fato iria para o Sentry: os erros vistos que o beforeSend não descarta.
function reportados() {
    return sentry.vistos.filter((erro) => removerDadosPessoais({ type: undefined }, { originalException: erro }) !== null);
}

beforeEach(async () => {
    sentry.vistos.length = 0;
    await zerarLimites();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Sentry no app", () => {
    it("registra o handler de erros do Sentry no app", () => {
        expect(registradoEm).toEqual([app]);
    });

    it("erro 500 passa pelo Sentry (depois das rotas) e é reportado; a resposta não muda", async () => {
        const erro = new Error("falha inesperada");
        prismaMock.animal.findMany.mockRejectedValue(erro);

        const res = await api().get("/api/publico/animais");

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno do servidor." });
        expect(sentry.vistos).toEqual([erro]);
        expect(reportados()).toEqual([erro]);
    });

    it("erro do Prisma que vira 404 não é reportado; a resposta não muda (tratarErros vem depois)", async () => {
        prismaMock.animal.findMany.mockRejectedValue(erroPrisma("P2025"));

        const res = await api().get("/api/publico/animais");

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Registro não encontrado." });
        expect(sentry.vistos).toHaveLength(1);
        expect(reportados()).toEqual([]);
    });

    it("validação (AppError 400) não é reportada", async () => {
        const res = await api().post("/api/publico/interesses").send({ nome: "Ana" });

        expect(res.status).toBe(400);
        expect(reportados()).toEqual([]);
    });

    it("JSON inválido (400) não é reportado", async () => {
        const res = await api().post("/api/publico/interesses").set("Content-Type", "application/json").send("{inválido");

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "JSON inválido no corpo da requisição." });
        expect(reportados()).toEqual([]);
    });

    it("rota inexistente continua 404 sem passar pelo Sentry", async () => {
        const res = await api().get("/api/nao-existe");

        expect(res.status).toBe(404);
        expect(sentry.vistos).toEqual([]);
    });
});
