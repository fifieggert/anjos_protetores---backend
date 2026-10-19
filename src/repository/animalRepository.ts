import prisma from "../config/prisma";
import { Prisma, StatusAnimal } from "@prisma/client";
import type { Especie, Porte } from "@prisma/client";

// Sem as solicitações: nome e telefone dos interessados só aparecem nas rotas de
// solicitações de adoção, que são exclusivas do ADMIN.
export const animalSelect = {
    id: true,
    nome: true,
    especie: true,
    raca: true,
    idade: true,
    porte: true,
    status: true,
    fotoUrl: true,
    descricao: true,
    sexo: true,
    castrado: true,
    dataCastracao: true,
    vacinado: true,
    dosesVacina: true,
    dataRevacinacao: true,
    criadoEm: true,
} satisfies Prisma.AnimalSelect;

// Campos exibidos no site público: sem solicitações, cadastrante ou datas internas.
const animalPublicoSelect = {
    id: true,
    nome: true,
    especie: true,
    raca: true,
    idade: true,
    porte: true,
    fotoUrl: true,
    descricao: true,
    sexo: true,
    castrado: true,
} satisfies Prisma.AnimalSelect;

export interface FiltrosAnimalPublico {
    especie?: Especie;
    porte?: Porte;
}

export class animalRepository {
    create(data: Prisma.AnimalCreateInput) {
        return prisma.animal.create({
            data,
            select: animalSelect,
        });
    }

    findAll() {
        return prisma.animal.findMany({
            select: animalSelect,
            orderBy: { criadoEm: "desc" },
        });
    }

    findById(id: string) {
        return prisma.animal.findUnique({
            where: { id },
            select: animalSelect,
        });
    }

    findDisponiveis(filtros: FiltrosAnimalPublico) {
        return prisma.animal.findMany({
            where: { status: StatusAnimal.DISPONIVEL, ...filtros },
            select: animalPublicoSelect,
            orderBy: { criadoEm: "desc" },
        });
    }

    exists(id: string) {
        return prisma.animal.findUnique({
            where: { id },
            select: { id: true },
        });
    }

    delete(id: string) {
        return prisma.animal.delete({
            where: { id },
        });
    }
}
