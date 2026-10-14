import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

const itemEstoqueSelect = {
    id: true,
    nomeItem: true,
    categoria: true,
    quantidadeAtual: true,
    quantidadeMinima: true,
    criadoEm: true,
    doacoes: true,
    saidas: true,
} satisfies Prisma.ItemEstoqueSelect;

export class itemEstoqueRepository {
    create(data: Prisma.ItemEstoqueCreateInput) {
        return prisma.itemEstoque.create({
            data,
            select: itemEstoqueSelect,
        });
    }

    findAll() {
        return prisma.itemEstoque.findMany({
            select: itemEstoqueSelect,
            orderBy: { criadoEm: "desc" },
        });
    }

    findById(id: string) {
        return prisma.itemEstoque.findUnique({
            where: { id },
            select: itemEstoqueSelect,
        });
    }

    update(id: string, data: Prisma.ItemEstoqueUpdateInput) {
        return prisma.itemEstoque.update({
            where: { id },
            data,
            select: itemEstoqueSelect,
        });
    }

    delete(id: string) {
        return prisma.itemEstoque.delete({
            where: { id },
        });
    }
}
