import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";
import { usuarioSelect } from "./usuarioRepository";

export const doacaoSelect = {
    id: true,
    itemId: true,
    item: true,
    usuarioId: true,
    usuario: { select: usuarioSelect },
    quantidade: true,
    doador: true,
    dataEntrada: true,
} satisfies Prisma.DoacaoSelect;

// Criar e excluir mexem no saldo do item: ficam no estoqueService, em transação.
export class doacaoRepository {
    findAll() {
        return prisma.doacao.findMany({
            select: doacaoSelect,
            orderBy: { dataEntrada: "desc" },
        });
    }

    findById(id: string) {
        return prisma.doacao.findUnique({
            where: { id },
            select: doacaoSelect,
        });
    }

    update(id: string, data: Prisma.DoacaoUpdateInput) {
        return prisma.doacao.update({
            where: { id },
            data,
            select: doacaoSelect,
        });
    }
}
