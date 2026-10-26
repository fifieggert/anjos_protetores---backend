import { Prisma } from "@prisma/client";
import { expect } from "vitest";
import { AppError } from "../../utils/AppError";

export function erroPrisma(code: string, meta?: Record<string, unknown>) {
    return new Prisma.PrismaClientKnownRequestError(`erro ${code} com dados internos`, {
        code,
        clientVersion: "teste",
        ...(meta ? { meta } : {}),
    });
}

// Confere que a promessa falha com um AppError com esse status (e mensagem, se informada).
export async function esperarAppError(promessa: Promise<unknown>, status: number, mensagem?: string | RegExp) {
    const erro = await promessa.then(
        () => {
            throw new Error("era esperado um AppError");
        },
        (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).status).toBe(status);
    if (mensagem !== undefined) expect((erro as AppError).message).toMatch(mensagem);
    return erro as AppError;
}
