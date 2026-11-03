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

// quantidadeMinima 0 significa "sem alerta".
function comAlerta<T extends { quantidadeAtual: number; quantidadeMinima: number }>(item: T) {
    return {
        ...item,
        abaixoDoMinimo: item.quantidadeMinima > 0 && item.quantidadeAtual < item.quantidadeMinima,
    };
}

export class itemEstoqueRepository {
    async create(data: Prisma.ItemEstoqueCreateInput) {
        const item = await prisma.itemEstoque.create({
            data,
            select: itemEstoqueSelect,
        });
        return comAlerta(item);
    }

    async findAll() {
        const itens = await prisma.itemEstoque.findMany({
            select: itemEstoqueSelect,
            orderBy: { criadoEm: "desc" },
        });
        return itens.map(comAlerta);
    }

    // Compara as duas colunas no banco via referência de campo do Prisma.
    async findAbaixoDoMinimo() {
        const itens = await prisma.itemEstoque.findMany({
            where: {
                quantidadeMinima: { gt: 0 },
                quantidadeAtual: { lt: prisma.itemEstoque.fields.quantidadeMinima },
            },
            select: itemEstoqueSelect,
            orderBy: { nomeItem: "asc" },
        });
        return itens.map(comAlerta);
    }

    async findById(id: string) {
        const item = await prisma.itemEstoque.findUnique({
            where: { id },
            select: itemEstoqueSelect,
        });
        return item && comAlerta(item);
    }

    async update(id: string, data: Prisma.ItemEstoqueUpdateInput) {
        const item = await prisma.itemEstoque.update({
            where: { id },
            data,
            select: itemEstoqueSelect,
        });
        return comAlerta(item);
    }

    delete(id: string) {
        return prisma.itemEstoque.delete({
            where: { id },
        });
    }
}
