import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";
import { usuarioSelect } from "./usuarioRepository";

export const saidaEstoqueSelect = {
    id: true,
    itemId: true,
    item: true,
    usuarioId: true,
    usuario: { select: usuarioSelect },
    quantidade: true,
    finalidade: true,
    dataSaida: true,
} satisfies Prisma.SaidaEstoqueSelect;

// Criar e excluir mexem no saldo do item: ficam no estoqueService, em transação.
export class saidaEstoqueRepository {
    findAll() {
        return prisma.saidaEstoque.findMany({
            select: saidaEstoqueSelect,
            orderBy: { dataSaida: "desc" },
        });
    }

    findById(id: string) {
        return prisma.saidaEstoque.findUnique({
            where: { id },
            select: saidaEstoqueSelect,
        });
    }

    update(id: string, data: Prisma.SaidaEstoqueUncheckedUpdateInput) {
        return prisma.saidaEstoque.update({
            where: { id },
            data,
            select: saidaEstoqueSelect,
        });
    }
}
