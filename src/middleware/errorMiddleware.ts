import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";

// Lê o campo envolvido em um P2002 (unique). O formato de meta.target varia
// conforme o driver: pode ser a lista de campos ou o nome do índice.
function campoDuplicado(meta: Record<string, unknown> | undefined) {
    const alvo = JSON.stringify(meta ?? {}).toLowerCase();
    if (alvo.includes("email")) return "Já existe um cadastro com este e-mail.";
    if (alvo.includes("cpf")) return "Já existe um cadastro com este CPF.";
    return "Já existe um registro com este valor.";
}

function erroDoPrisma(err: Prisma.PrismaClientKnownRequestError): [number, string] | null {
    switch (err.code) {
        case "P2025":
            return [404, "Registro não encontrado."];
        case "P2002":
            return [409, campoDuplicado(err.meta)];
        case "P2003":
            return [409, "Operação não permitida: o registro está em uso ou faz referência a um registro inexistente."];
        case "P2014":
            return [409, "Operação não permitida: o registro já está vinculado a outro."];
        case "P2034":
            // conflito entre transações simultâneas que sobrou depois das novas tentativas
            return [409, "Outra operação alterou estes dados ao mesmo tempo. Tente novamente."];
        case "P2000":
            return [400, "Um dos textos excede o tamanho permitido."];
        default:
            return null;
    }
}

// Erros lançados pelo express.json (body-parser) têm `type` e `status`.
function erroDoCorpo(err: unknown): [number, string] | null {
    if (typeof err !== "object" || err === null || !("type" in err)) return null;
    switch ((err as { type: unknown }).type) {
        case "entity.parse.failed":
            return [400, "JSON inválido no corpo da requisição."];
        case "entity.too.large":
            return [413, "O corpo da requisição é grande demais."];
        case "encoding.unsupported":
        case "charset.unsupported":
            return [415, "Codificação do corpo da requisição não suportada."];
        default:
            return null;
    }
}

// Erros do Prisma podem trazer na mensagem os valores da consulta (ex.: nome e telefone
// de um interessado em adoção). Para nenhum dado pessoal ir para o log, deles só
// registramos o tipo e o código.
function registrarErro(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        console.error(`[erro] ${err.name} ${err.code}`);
    } else if (err instanceof Error && err.name.startsWith("PrismaClient")) {
        console.error(`[erro] ${err.name}`);
    } else {
        console.error(err);
    }
}

// Erros do Prisma e do express.json que têm resposta própria (4xx). null = erro inesperado (500).
function erroConhecido(err: unknown): [number, string] | null {
    return (err instanceof Prisma.PrismaClientKnownRequestError ? erroDoPrisma(err) : null) ?? erroDoCorpo(err);
}

// Monitoramento (Sentry): só reporta o que o tratarErros responde com 500 inesperado.
// AppError é sempre esperado (mesmo um 503, como o upload desabilitado) e os erros
// conhecidos viram 4xx, então nenhum deles é reportado.
export function deveReportarErro(err: unknown): boolean {
    return !(err instanceof AppError) && erroConhecido(err) === null;
}

export function rotaNaoEncontrada(_req: Request, res: Response) {
    res.status(404).json({ error: "Rota não encontrada." });
}

// Deve ser o último middleware do app. Nunca devolve stack nem detalhes internos.
export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
        return res.status(err.status).json(err.campos ? { error: err.message, campos: err.campos } : { error: err.message });
    }

    const conhecido = erroConhecido(err);

    if (conhecido) {
        const [status, mensagem] = conhecido;
        return res.status(status).json({ error: mensagem });
    }

    registrarErro(err);
    return res.status(500).json({ error: "Erro interno do servidor." });
}
