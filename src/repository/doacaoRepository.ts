import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

const doacaoSelect = {
    id: true,
    itemId: true,
    item: true,
    usuarioId: true,
    usuario: true,
    quantidade: true,
    doador: true,
    dataEntrada: true,
} satisfies Prisma.DoacaoSelect;

export class doacaoRepository {
    create(data: Prisma.DoacaoCreateInput) {
        return prisma.doacao.create({
            data,
            select: doacaoSelect,
        });
    }

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

    delete(id: string) {
        return prisma.doacao.delete({
            where: { id },
        });
    }
}
