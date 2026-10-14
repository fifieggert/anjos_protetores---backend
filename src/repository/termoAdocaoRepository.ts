import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

const termoAdocaoSelect = {
    id: true,
    solicitacaoId: true,
    solicitacao: true,
    geradoEm: true,
    urlDocumento: true,
} satisfies Prisma.TermoAdocaoSelect;

export class termoAdocaoRepository {
    create(data: Prisma.TermoAdocaoCreateInput) {
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

    findBySolicitacaoId(solicitacaoId: string) {
        return prisma.termoAdocao.findUnique({
            where: { solicitacaoId },
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
