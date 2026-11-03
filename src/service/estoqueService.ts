import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";
import { doacaoSelect } from "../repository/doacaoRepository";
import { saidaEstoqueSelect } from "../repository/saidaEstoqueRepository";

const ITEM_NAO_ENCONTRADO = "Item de estoque não encontrado.";

export interface NovaDoacao {
    itemId: string;
    usuarioId: string;
    quantidade: number;
    doador: string;
    dataEntrada?: Date;
}

export interface NovaSaida {
    itemId: string;
    usuarioId: string;
    quantidade: number;
    finalidade: string;
    dataSaida?: Date;
}

// Regras que mexem no saldo do estoque. Cada operação roda numa transação: se
// qualquer passo falhar (inclusive um AppError), nada é gravado.
export class estoqueService {
    registrarDoacao(dados: NovaDoacao) {
        return prisma.$transaction(async (tx) => {
            const { count } = await tx.itemEstoque.updateMany({
                where: { id: dados.itemId },
                data: { quantidadeAtual: { increment: dados.quantidade } },
            });
            if (count === 0) throw new AppError(404, ITEM_NAO_ENCONTRADO);

            return tx.doacao.create({ data: dados, select: doacaoSelect });
        });
    }

    registrarSaida(dados: NovaSaida) {
        return prisma.$transaction(async (tx) => {
            // Baixa atômica: o UPDATE só afeta a linha se houver saldo, então duas
            // saídas simultâneas nunca deixam o estoque negativo.
            const { count } = await tx.itemEstoque.updateMany({
                where: { id: dados.itemId, quantidadeAtual: { gte: dados.quantidade } },
                data: { quantidadeAtual: { decrement: dados.quantidade } },
            });

            if (count === 0) {
                const item = await tx.itemEstoque.findUnique({
                    where: { id: dados.itemId },
                    select: { quantidadeAtual: true },
                });
                if (!item) throw new AppError(404, ITEM_NAO_ENCONTRADO);
                throw new AppError(409, `Estoque insuficiente. Disponível: ${item.quantidadeAtual}.`);
            }

            return tx.saidaEstoque.create({ data: dados, select: saidaEstoqueSelect });
        });
    }

    // Excluir uma doação desfaz a entrada: a quantidade sai do estoque.
    excluirDoacao(id: string) {
        return prisma.$transaction(async (tx) => {
            const doacao = await tx.doacao.findUnique({
                where: { id },
                select: { itemId: true, quantidade: true },
            });
            if (!doacao) throw new AppError(404, "Doação não encontrada.");

            await tx.doacao.delete({ where: { id } });

            const { count } = await tx.itemEstoque.updateMany({
                where: { id: doacao.itemId, quantidadeAtual: { gte: doacao.quantidade } },
                data: { quantidadeAtual: { decrement: doacao.quantidade } },
            });
            if (count === 0) {
                throw new AppError(409, "Não é possível excluir: o estoque atual é menor que a quantidade desta doação.");
            }
        });
    }

    // Excluir uma saída desfaz a baixa: a quantidade volta ao estoque.
    excluirSaida(id: string) {
        return prisma.$transaction(async (tx) => {
            const saida = await tx.saidaEstoque.findUnique({
                where: { id },
                select: { itemId: true, quantidade: true },
            });
            if (!saida) throw new AppError(404, "Saída de estoque não encontrada.");

            await tx.saidaEstoque.delete({ where: { id } });
            await tx.itemEstoque.update({
                where: { id: saida.itemId },
                data: { quantidadeAtual: { increment: saida.quantidade } },
            });
        });
    }
}
