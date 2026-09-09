import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

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
