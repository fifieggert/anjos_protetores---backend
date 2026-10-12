import prisma from "../config/prisma";
import { Prisma, StatusAnimal } from "@prisma/client";
import type { Especie, Porte } from "@prisma/client";

const animalSelect = {
    id: true,
    nome: true,
    especie: true,
    raca: true,
    idade: true,
    porte: true,
    status: true,
    fotoUrl: true,
    descricao: true,
    criadoEm: true,
    solicitacoes: true,
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

    findStatusById(id: string) {
        return prisma.animal.findUnique({
            where: { id },
            select: { id: true, status: true },
        });
    }

    update(id: string, data: Prisma.AnimalUpdateInput) {
        return prisma.animal.update({
            where: { id },
            data,
            select: animalSelect,
        });
    }

    delete(id: string) {
        return prisma.animal.delete({
            where: { id },
        });
    }
}
