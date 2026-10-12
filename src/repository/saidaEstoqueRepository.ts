import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

const saidaEstoqueSelect = {
    id: true,
    itemId: true,
    item: true,
    usuarioId: true,
    usuario: true,
    quantidade: true,
    finalidade: true,
    dataSaida: true,
} satisfies Prisma.SaidaEstoqueSelect;

export class saidaEstoqueRepository {
    create(data: Prisma.SaidaEstoqueUncheckedCreateInput) {
        return prisma.saidaEstoque.create({
            data,
            select: saidaEstoqueSelect,
        });
    }

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

    delete(id: string) {
        return prisma.saidaEstoque.delete({
            where: { id },
        });
    }
}
