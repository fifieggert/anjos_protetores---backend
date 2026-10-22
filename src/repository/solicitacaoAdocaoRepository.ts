import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

// Uso interno (ADMIN): nome e telefone nunca saem por rota pública.
export const solicitacaoAdocaoSelect = {
    id: true,
    nome: true,
    telefone: true,
    status: true,
    criadoEm: true,
    atualizadoEm: true,
    animal: { select: { id: true, nome: true, especie: true, fotoUrl: true } },
} satisfies Prisma.SolicitacaoAdocaoSelect;

export class solicitacaoAdocaoRepository {
    findAll(filtros: Prisma.SolicitacaoAdocaoWhereInput) {
        return prisma.solicitacaoAdocao.findMany({
            where: filtros,
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
}
