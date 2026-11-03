import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { emTransacaoSerializavel } from "../../service/transacao";
import { AppError } from "../../utils/AppError";
import { prismaMock } from "../helpers/prisma";
import { erroPrisma } from "../helpers/erros";

describe("emTransacaoSerializavel", () => {
    it("roda a operação numa transação SERIALIZABLE e devolve o resultado", async () => {
        const operacao = vi.fn<() => Promise<string>>().mockResolvedValue("ok");
        await expect(emTransacaoSerializavel(operacao)).resolves.toBe("ok");
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.$transaction).toHaveBeenCalledWith(operacao, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
    });

    it("repete quando o banco desfaz por conflito (P2034) e para no sucesso", async () => {
        prismaMock.$transaction
            .mockRejectedValueOnce(erroPrisma("P2034"))
            .mockRejectedValueOnce(erroPrisma("P2034"))
            .mockResolvedValueOnce("terceira" as never);
        await expect(emTransacaoSerializavel(vi.fn<() => Promise<unknown>>())).resolves.toBe("terceira");
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
    });

    it("desiste depois de 3 tentativas com P2034 e repassa o erro", async () => {
        const conflito = erroPrisma("P2034");
        prismaMock.$transaction.mockRejectedValue(conflito);
        await expect(emTransacaoSerializavel(vi.fn<() => Promise<unknown>>())).rejects.toBe(conflito);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
    });

    it.each([
        ["outro erro do Prisma (P2002)", erroPrisma("P2002")],
        ["AppError de regra de negócio", new AppError(409, "regra")],
        ["erro qualquer", new Error("falhou")],
    ])("não repete em caso de %s", async (_caso, erro) => {
        prismaMock.$transaction.mockRejectedValue(erro);
        await expect(emTransacaoSerializavel(vi.fn<() => Promise<unknown>>())).rejects.toBe(erro);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
});
