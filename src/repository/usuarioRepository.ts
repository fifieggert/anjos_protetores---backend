import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

const usuarioSelect = {
    id: true,
    nome: true,
    cpf: true,
    email: true,
    senhaHash: true,
    perfil: true,
    ativo: true,
    criadoEm: true,
} satisfies Prisma.UsuarioSelect;

export class usuarioRepository {
    create(data: Prisma.UsuarioCreateInput) {
        return prisma.usuario.create({
            data,
            select: usuarioSelect,
        });
    }

    findAll() {
        return prisma.usuario.findMany({
            select: usuarioSelect,
            orderBy: { criadoEm: "desc" },
        });
    }

    findById(id: string) {
        return prisma.usuario.findUnique({
            where: { id },
            select: usuarioSelect,
        });
    }

    findByEmail(email: string) {
        return prisma.usuario.findUnique({
            where: { email },
        });
    }

    update(id: string, data: Prisma.UsuarioUpdateInput) {
        return prisma.usuario.update({
            where: { id },
            data,
            select: usuarioSelect,
        });
    }

    delete(id: string) {
        return prisma.usuario.delete({
            where: { id },
        });
    }
}
