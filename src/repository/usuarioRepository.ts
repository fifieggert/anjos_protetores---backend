import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

// Campos públicos do usuário: nunca inclua senhaHash aqui.
export const usuarioSelect = {
    id: true,
    nome: true,
    cpf: true,
    email: true,
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
            select: usuarioSelect,
        });
    }

    // Uso exclusivo do login: retorna o senhaHash para comparação.
    findByEmailComSenha(email: string) {
        return prisma.usuario.findUnique({
            where: { email },
            select: { ...usuarioSelect, senhaHash: true },
        });
    }

    // Uso exclusivo da troca de senha: retorna o senhaHash para comparação.
    findByIdComSenha(id: string) {
        return prisma.usuario.findUnique({
            where: { id },
            select: { id: true, ativo: true, senhaHash: true },
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
