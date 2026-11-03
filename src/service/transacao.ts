import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

const TENTATIVAS = 3;

function ehConflitoEntreTransacoes(erro: unknown) {
    return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2034";
}

// Transação SERIALIZABLE: no MySQL as leituras feitas dentro dela travam as linhas (e os
// intervalos do índice) lidos, então duas requisições simultâneas não passam juntas pela
// mesma checagem, como "este telefone já tem interesse em andamento?". Quando o banco
// desfaz uma delas por conflito (deadlock), ela é repetida do zero e, na nova tentativa,
// a checagem já enxerga o que a outra gravou. Um AppError lançado dentro dela desfaz tudo.
export async function emTransacaoSerializavel<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let tentativa = 1; ; tentativa++) {
        try {
            return await prisma.$transaction(operacao, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        } catch (erro) {
            if (tentativa >= TENTATIVAS || !ehConflitoEntreTransacoes(erro)) throw erro;
        }
    }
}
