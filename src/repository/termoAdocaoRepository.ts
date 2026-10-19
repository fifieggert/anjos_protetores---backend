import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

// Sem dados do interessado: só o vínculo com a solicitação.
const termoAdocaoSelect = {
    id: true,
    animalId: true,
    animal: { select: { id: true, nome: true } },
    solicitacaoId: true,
    geradoPor: { select: { id: true, nome: true } },
    geradoEm: true,
    assinado: true,
    assinadoEm: true,
} satisfies Prisma.TermoAdocaoSelect;

export class termoAdocaoRepository {
    create(data: Prisma.TermoAdocaoUncheckedCreateInput) {
        return prisma.termoAdocao.create({
            data,
            select: termoAdocaoSelect,
        });
    }

    findAll() {
        return prisma.termoAdocao.findMany({
            select: termoAdocaoSelect,
            orderBy: { geradoEm: "desc" },
        });
    }

    findById(id: string) {
        return prisma.termoAdocao.findUnique({
            where: { id },
            select: termoAdocaoSelect,
        });
    }

    update(id: string, data: Prisma.TermoAdocaoUpdateInput) {
        return prisma.termoAdocao.update({
            where: { id },
            data,
            select: termoAdocaoSelect,
        });
    }

    delete(id: string) {
        return prisma.termoAdocao.delete({
            where: { id },
        });
    }
}
