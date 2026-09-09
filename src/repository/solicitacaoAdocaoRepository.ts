import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

const solicitacaoAdocaoSelect = {
    id: true,
    animalId: true,
    animal: true,
    nomeInteressado: true,
    email: true,
    telefone: true,
    status: true,
    justificativa: true,
    criadoEm: true,
    termo: true,
} satisfies Prisma.SolicitacaoAdocaoSelect;

export class solicitacaoAdocaoRepository {
    create(data: Prisma.SolicitacaoAdocaoCreateInput) {
        return prisma.solicitacaoAdocao.create({
            data,
            select: solicitacaoAdocaoSelect,
        });
    }

    findAll() {
        return prisma.solicitacaoAdocao.findMany({
            select: solicitacaoAdocaoSelect,
            orderBy: { criadoEm: "desc" },
        });
    }

    findById(id: string) {
        return prisma.solicitacaoAdocao.findUnique({
            where: { id },
            select: solicitacaoAdocaoSelect,
        });
    }

    update(id: string, data: Prisma.SolicitacaoAdocaoUpdateInput) {
        return prisma.solicitacaoAdocao.update({
            where: { id },
            data,
            select: solicitacaoAdocaoSelect,
        });
    }

    delete(id: string) {
        return prisma.solicitacaoAdocao.delete({
            where: { id },
        });
    }
}
