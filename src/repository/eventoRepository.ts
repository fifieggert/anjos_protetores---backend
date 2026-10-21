import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";
import { diaDoBanco } from "../utils/datas";

export const eventoSelect = {
    id: true,
    titulo: true,
    descricao: true,
    data: true,
    horarioInicio: true,
    horarioFim: true,
    local: true,
    imagemUrl: true,
    criadoEm: true,
    atualizadoEm: true,
    criadoPor: { select: { id: true, nome: true } },
} satisfies Prisma.EventoSelect;

// Campos exibidos no site público: sem quem cadastrou nem datas internas.
const eventoPublicoSelect = {
    id: true,
    titulo: true,
    descricao: true,
    data: true,
    horarioInicio: true,
    horarioFim: true,
    local: true,
    imagemUrl: true,
} satisfies Prisma.EventoSelect;

const ordemCronologica: Prisma.EventoOrderByWithRelationInput[] = [{ data: "asc" }, { horarioInicio: "asc" }];

// A data sai como AAAA-MM-DD (ver diaDoBanco).
export function comDia<T extends { data: Date }>(evento: T) {
    return { ...evento, data: diaDoBanco(evento.data) };
}

export class eventoRepository {
    async findAll(where: Prisma.EventoWhereInput) {
        const eventos = await prisma.evento.findMany({ where, select: eventoSelect, orderBy: ordemCronologica });
        return eventos.map(comDia);
    }

    async findById(id: string) {
        const evento = await prisma.evento.findUnique({ where: { id }, select: eventoSelect });
        return evento && comDia(evento);
    }

    // Do dia informado em diante (inclusive), do mais próximo ao mais distante.
    async findPublicos(aPartirDe: Date, limite: number) {
        const eventos = await prisma.evento.findMany({
            where: { data: { gte: aPartirDe } },
            select: eventoPublicoSelect,
            orderBy: ordemCronologica,
            take: limite,
        });
        return eventos.map(comDia);
    }

    delete(id: string) {
        return prisma.evento.delete({
            where: { id },
        });
    }
}
