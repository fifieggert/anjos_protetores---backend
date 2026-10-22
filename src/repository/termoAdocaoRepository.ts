import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

// Sem dados do interessado: só o vínculo com a solicitação.
export const termoAdocaoSelect = {
    id: true,
    animalId: true,
    animal: { select: { id: true, nome: true } },
    solicitacaoId: true,
    geradoPor: { select: { id: true, nome: true } },
    geradoEm: true,
    assinado: true,
    assinadoEm: true,
} satisfies Prisma.TermoAdocaoSelect;

// Dados para montar o PDF: os ATUAIS do animal e da solicitação. Contém nome e telefone
// do interessado: usar só na rota do PDF (ADMIN) e nunca registrar em log.
const termoParaPdfSelect = {
    id: true,
    geradoEm: true,
    animal: {
        select: {
            nome: true,
            especie: true,
            raca: true,
            idade: true,
            porte: true,
            sexo: true,
            castrado: true,
            dataCastracao: true,
            vacinado: true,
            dosesVacina: true,
            dataRevacinacao: true,
            descricao: true,
        },
    },
    solicitacao: { select: { nome: true, telefone: true } },
    geradoPor: { select: { nome: true } },
} satisfies Prisma.TermoAdocaoSelect;

export type TermoParaPdf = Prisma.TermoAdocaoGetPayload<{ select: typeof termoParaPdfSelect }>;

export class termoAdocaoRepository {
    findParaPdf(id: string) {
        return prisma.termoAdocao.findUnique({
            where: { id },
            select: termoParaPdfSelect,
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
