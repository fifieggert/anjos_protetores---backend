import type { Request, Response } from "express";
import { vi } from "vitest";

// Request/Response mínimos para testar middlewares sem subir o app.
export function requisicao(dados: Partial<Request> = {}): Request {
    return { headers: {}, params: {}, query: {}, body: undefined, ...dados } as Request;
}

interface RespostaFalsa {
    statusCode: number;
    corpo: unknown;
    locals: Record<string, unknown>;
}

export function resposta() {
    const res: RespostaFalsa = { statusCode: 200, corpo: undefined, locals: {} };
    const metodos = {
        status: vi.fn<(codigo: number) => unknown>((codigo) => {
            res.statusCode = codigo;
            return res;
        }),
        json: vi.fn<(corpo: unknown) => unknown>((corpo) => {
            res.corpo = corpo;
            return res;
        }),
    };
    return Object.assign(res, metodos) as RespostaFalsa & typeof metodos & Response;
}

// assinatura simples: o NextFunction do Express tem sobrecargas que o Mock não aceita
export const proximo = () => vi.fn<(erro?: unknown) => void>();
