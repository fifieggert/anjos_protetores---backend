// Monitoramento de erros e desempenho (Sentry). Precisa ser importado logo depois do
// "dotenv/config" e antes de qualquer outro módulo do server.ts, para o SDK instrumentar
// o Express e o HTTP. Sem SENTRY_DSN, fica desligado: nada é inicializado e nenhuma
// chamada de rede é feita (padrão em desenvolvimento e nos testes).
import * as Sentry from "@sentry/node";
import type { ErrorEvent, EventHint, NodeOptions } from "@sentry/node";
import { deveReportarErro } from "./middleware/errorMiddleware";

type Ambiente = Record<string, string | undefined>;

// Fração das requisições com trace de desempenho (0 a 1), quando a variável não é válida.
export const TAXA_TRACES_PADRAO = 0.2;

function taxaDeTraces(valor: string | undefined): number {
    const texto = valor?.trim();
    const taxa = texto ? Number(texto) : Number.NaN;
    return Number.isFinite(taxa) && taxa >= 0 && taxa <= 1 ? taxa : TAXA_TRACES_PADRAO;
}

// beforeSend. LGPD: a API recebe nome e telefone de interessados em adoção, então nenhum
// evento leva corpo, cookies, headers (Authorization com o token) nem a query string,
// nem dentro da URL. Também descarta erros esperados (AppError e os que viram 4xx),
// inclusive os que o setupExpressErrorHandler capturaria com o filtro padrão do SDK.
export function removerDadosPessoais(evento: ErrorEvent, hint: EventHint): ErrorEvent | null {
    const original = hint.originalException;
    if (typeof original === "object" && original !== null && !deveReportarErro(original)) {
        return null;
    }

    if (evento.request) {
        const { data: _data, cookies: _cookies, headers: _headers, query_string: _query, ...restante } = evento.request;
        if (restante.url) restante.url = restante.url.replace(/[?#].*$/s, "");
        evento.request = restante;
    }

    return evento;
}

// Nada de usuário, cookies, headers, corpos, query string, dados de consultas ao banco nem
// variáveis locais dos stack frames (podem conter nome e telefone de um interessado).
const SEM_DADOS_PESSOAIS: NonNullable<NodeOptions["dataCollection"]> = {
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
};

export function iniciarSentry(ambiente: Ambiente): boolean {
    const dsn = ambiente["SENTRY_DSN"]?.trim();
    if (!dsn) return false;

    Sentry.init({
        dsn,
        environment: ambiente["NODE_ENV"],
        // Equivale ao antigo sendDefaultPii: false, que não existe mais no SDK v11: os
        // padrões do dataCollection coletam tudo, então cada categoria é desligada.
        dataCollection: SEM_DADOS_PESSOAIS,
        tracesSampleRate: taxaDeTraces(ambiente["SENTRY_TRACES_SAMPLE_RATE"]),
        // A captura automática do Express usa o mesmo critério do tratarErros: só 500.
        integrations: [Sentry.expressIntegration({ shouldHandleError: deveReportarErro })],
        beforeSend: removerDadosPessoais,
    });
    return true;
}

export const SENTRY_ATIVO = iniciarSentry(process.env);

// Mensagem enviada quando o servidor sobe, para confirmar a integração no painel do Sentry.
export function avisarApiIniciada(ativo: boolean = SENTRY_ATIVO) {
    if (ativo) Sentry.captureMessage("API iniciada", "info");
}
