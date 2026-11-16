import type { ErrorEvent, EventHint } from "@sentry/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/AppError";
import { deveReportarErro } from "../middleware/errorMiddleware";
import { erroPrisma } from "./helpers/erros";

// @sentry/node falso: nenhum teste inicializa o SDK de verdade nem faz chamada de rede.
const sentry = vi.hoisted(() => ({
    init: vi.fn<(opcoes: unknown) => void>(),
    captureMessage: vi.fn<(mensagem: string, nivel: string) => void>(),
    expressIntegration: vi.fn<(opcoes: unknown) => unknown>((opcoes) => ({ name: "Express", opcoes })),
}));
vi.mock("@sentry/node", () => sentry);

import { SENTRY_ATIVO, TAXA_TRACES_PADRAO, avisarApiIniciada, iniciarSentry, removerDadosPessoais } from "../instrument";

// Valor obviamente falso: nenhum DSN real vai para os testes.
const DSN_FALSO = "https://chavefalsa@sentry.exemplo.invalid/1";

type OpcoesInit = {
    dsn: string;
    environment: string | undefined;
    dataCollection: Record<string, unknown>;
    tracesSampleRate: number;
    beforeSend: (evento: ErrorEvent, hint: EventHint) => ErrorEvent | null;
    integrations: { name: string; opcoes: { shouldHandleError: unknown } }[];
};

function opcoesDoInit(): OpcoesInit {
    return sentry.init.mock.calls[0]?.[0] as OpcoesInit;
}

function eventoComDadosPessoais(): ErrorEvent {
    return {
        type: undefined,
        message: "falha",
        request: {
            method: "POST",
            url: "https://api.exemplo.invalid/api/publico/interesses?telefone=47999998888&nome=Ana",
            query_string: "telefone=47999998888&nome=Ana",
            data: { nome: "Ana", telefone: "(47) 99999-8888" },
            cookies: { sessao: "cookie-falso" },
            headers: { authorization: "Bearer token-falso", "user-agent": "teste" },
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("iniciarSentry", () => {
    it.each([
        ["sem SENTRY_DSN", {}],
        ["SENTRY_DSN vazio", { SENTRY_DSN: "" }],
        ["SENTRY_DSN só com espaços", { SENTRY_DSN: "   " }],
    ])("%s: fica desligado e não chama o init (nenhuma rede)", (_caso, ambiente) => {
        expect(iniciarSentry(ambiente)).toBe(false);
        expect(sentry.init).not.toHaveBeenCalled();
    });

    it("ao importar o módulo sem SENTRY_DSN (ambiente dos testes), não inicializa", async () => {
        vi.resetModules();
        vi.stubEnv("SENTRY_DSN", "");
        try {
            const modulo = await import("../instrument.js");
            expect(modulo.SENTRY_ATIVO).toBe(false);
            expect(sentry.init).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllEnvs();
        }
        expect(SENTRY_ATIVO).toBe(false);
    });

    it("com SENTRY_DSN: inicializa com ambiente, sem coletar dados pessoais e com a taxa padrão de traces", () => {
        expect(iniciarSentry({ SENTRY_DSN: ` ${DSN_FALSO} `, NODE_ENV: "production" })).toBe(true);

        expect(sentry.init).toHaveBeenCalledOnce();
        const opcoes = opcoesDoInit();
        expect(opcoes.dsn).toBe(DSN_FALSO);
        expect(opcoes.environment).toBe("production");
        // equivalente no SDK v11 ao antigo sendDefaultPii: false (que deixou de existir)
        expect(opcoes.dataCollection).toEqual({
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
            databaseQueryData: false,
            queues: false,
            stackFrameVariables: false,
            graphQL: { document: false, variables: false },
            genAI: { inputs: false, outputs: false },
            mcp: { inputs: false, outputs: false },
        });
        expect(opcoes.tracesSampleRate).toBe(TAXA_TRACES_PADRAO);
        expect(TAXA_TRACES_PADRAO).toBe(0.2);
        expect(opcoes.beforeSend).toBe(removerDadosPessoais);
    });

    it("o Express só captura erros que viram 5xx (mesmo filtro do tratarErros)", () => {
        iniciarSentry({ SENTRY_DSN: DSN_FALSO });
        const express = opcoesDoInit().integrations.find((integracao) => integracao.name === "Express");
        expect(express?.opcoes.shouldHandleError).toBe(deveReportarErro);
    });

    it.each([
        ["1", 1],
        ["0", 0],
        ["0.05", 0.05],
        [" 0.5 ", 0.5],
        [undefined, 0.2],
        ["", 0.2],
        ["abc", 0.2],
        ["1.5", 0.2],
        ["-0.1", 0.2],
    ])("SENTRY_TRACES_SAMPLE_RATE=%j vira %s", (valor, taxa) => {
        iniciarSentry({ SENTRY_DSN: DSN_FALSO, SENTRY_TRACES_SAMPLE_RATE: valor });
        expect(opcoesDoInit().tracesSampleRate).toBe(taxa);
    });
});

describe("removerDadosPessoais (beforeSend)", () => {
    it("remove corpo, cookies, headers (authorization) e a query string, mantendo método e caminho", () => {
        const evento = removerDadosPessoais(eventoComDadosPessoais(), { originalException: new Error("falha") });

        expect(evento?.request).toEqual({
            method: "POST",
            url: "https://api.exemplo.invalid/api/publico/interesses",
        });
        expect(JSON.stringify(evento)).not.toMatch(/Ana|47999998888|99999-8888|Bearer|cookie-falso/);
    });

    it("evento sem request passa sem mudanças", () => {
        const evento: ErrorEvent = { type: undefined, message: "API iniciada", level: "info" };
        expect(removerDadosPessoais(evento, { originalException: "API iniciada" })).toEqual({
            type: undefined,
            message: "API iniciada",
            level: "info",
        });
    });

    it("request sem URL continua sem URL", () => {
        const evento = removerDadosPessoais({ type: undefined, request: { method: "GET" } }, {});
        expect(evento?.request).toEqual({ method: "GET" });
    });

    it.each([
        ["AppError 400", new AppError(400, "Dados inválidos.")],
        ["AppError 404", new AppError(404, "Não encontrado.")],
        ["AppError 503 (esperado, ex.: upload desabilitado)", new AppError(503, "Indisponível.")],
        ["Prisma P2025 (vira 404)", erroPrisma("P2025")],
        ["Prisma P2002 (vira 409)", erroPrisma("P2002")],
        ["JSON inválido (vira 400)", Object.assign(new Error("x"), { type: "entity.parse.failed" })],
    ])("%s: descartado (não é 5xx inesperado)", (_caso, erro) => {
        expect(removerDadosPessoais(eventoComDadosPessoais(), { originalException: erro })).toBeNull();
    });

    it.each([
        ["Error comum", new Error("falha inesperada")],
        ["Prisma desconhecido (vira 500)", erroPrisma("P9999")],
    ])("%s: enviado", (_caso, erro) => {
        expect(removerDadosPessoais(eventoComDadosPessoais(), { originalException: erro })).not.toBeNull();
    });
});

describe("avisarApiIniciada", () => {
    it("com o Sentry ligado, envia a mensagem info \"API iniciada\"", () => {
        avisarApiIniciada(true);
        expect(sentry.captureMessage).toHaveBeenCalledExactlyOnceWith("API iniciada", "info");
    });

    it("desligado, não envia nada", () => {
        avisarApiIniciada(false);
        avisarApiIniciada();
        expect(sentry.captureMessage).not.toHaveBeenCalled();
    });
});
