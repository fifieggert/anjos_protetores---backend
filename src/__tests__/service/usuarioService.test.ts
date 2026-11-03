import bcrypt from "bcrypt";
import { beforeAll, describe, expect, it } from "vitest";
import { usuarioService } from "../../service/usuarioService";
import { prismaMock } from "../helpers/prisma";
import { esperarAppError } from "../helpers/erros";
import { ID_ADMIN, ID_OUTRO } from "../helpers/auth";

const service = new usuarioService();
const PROPRIO = "Você não pode desativar, rebaixar nem excluir o próprio usuário.";
const ULTIMO = /último administrador ativo/;

function alvo(perfil: "ADMIN" | "VOLUNTARIO", ativo = true) {
    prismaMock.usuario.findUnique.mockResolvedValue({ perfil, ativo } as never);
    prismaMock.usuario.update.mockResolvedValue({ id: ID_OUTRO } as never);
}

describe("usuarioService.atualizar", () => {
    it("usuário inexistente dá 404", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue(null);
        await esperarAppError(service.atualizar(ID_OUTRO, { nome: "X" }, ID_ADMIN), 404, "Usuário não encontrado.");
    });

    it("não deixa o ADMIN rebaixar a si mesmo", async () => {
        alvo("ADMIN");
        await esperarAppError(service.atualizar(ID_ADMIN, { perfil: "VOLUNTARIO" }, ID_ADMIN), 409, PROPRIO);
        expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it("não deixa o ADMIN desativar a si mesmo", async () => {
        alvo("ADMIN");
        await esperarAppError(service.atualizar(ID_ADMIN, { ativo: false }, ID_ADMIN), 409, PROPRIO);
    });

    it("deixa o ADMIN editar o próprio nome", async () => {
        alvo("ADMIN");
        await service.atualizar(ID_ADMIN, { nome: "Novo nome" }, ID_ADMIN);
        expect(prismaMock.usuario.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: ID_ADMIN }, data: { nome: "Novo nome" } }),
        );
        expect(prismaMock.usuario.count).not.toHaveBeenCalled();
    });

    it.each([
        ["desativar", { ativo: false }],
        ["rebaixar", { perfil: "VOLUNTARIO" as const }],
    ])("não deixa %s o último ADMIN ativo", async (_acao, dados) => {
        alvo("ADMIN");
        prismaMock.usuario.count.mockResolvedValue(0);

        await esperarAppError(service.atualizar(ID_OUTRO, dados, ID_ADMIN), 409, ULTIMO);
        expect(prismaMock.usuario.count).toHaveBeenCalledWith({
            where: { perfil: "ADMIN", ativo: true, id: { not: ID_OUTRO } },
        });
        expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it("rebaixa outro ADMIN quando ainda sobra outro ADMIN ativo", async () => {
        alvo("ADMIN");
        prismaMock.usuario.count.mockResolvedValue(1);
        await service.atualizar(ID_OUTRO, { perfil: "VOLUNTARIO" }, ID_ADMIN);
        expect(prismaMock.usuario.update).toHaveBeenCalled();
    });

    it("manter o perfil ADMIN não conta como rebaixar", async () => {
        alvo("ADMIN");
        await service.atualizar(ID_ADMIN, { perfil: "ADMIN" }, ID_ADMIN);
        expect(prismaMock.usuario.count).not.toHaveBeenCalled();
    });

    it("desativar VOLUNTARIO ou ADMIN já inativo não exige outro ADMIN", async () => {
        alvo("VOLUNTARIO");
        await service.atualizar(ID_OUTRO, { ativo: false }, ID_ADMIN);
        alvo("ADMIN", false);
        await service.atualizar(ID_OUTRO, { perfil: "VOLUNTARIO" }, ID_ADMIN);
        expect(prismaMock.usuario.count).not.toHaveBeenCalled();
    });

    it("troca de senha pelo ADMIN grava só o hash (nunca a senha em texto)", async () => {
        alvo("VOLUNTARIO");
        await service.atualizar(ID_OUTRO, { senha: "nova-senha-123", nome: "Ana" }, ID_ADMIN);

        const data = prismaMock.usuario.update.mock.calls[0]?.[0].data as Record<string, unknown>;
        expect(data).not.toHaveProperty("senha");
        expect(data["nome"]).toBe("Ana");
        await expect(bcrypt.compare("nova-senha-123", data["senhaHash"] as string)).resolves.toBe(true);
    });
});

describe("usuarioService.excluir", () => {
    it("não deixa excluir o próprio usuário (nem abre transação)", async () => {
        await esperarAppError(service.excluir(ID_ADMIN, ID_ADMIN), 409, PROPRIO);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("usuário inexistente dá 404", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue(null);
        await esperarAppError(service.excluir(ID_OUTRO, ID_ADMIN), 404);
    });

    it("não deixa excluir o último ADMIN ativo", async () => {
        alvo("ADMIN");
        prismaMock.usuario.count.mockResolvedValue(0);
        await esperarAppError(service.excluir(ID_OUTRO, ID_ADMIN), 409, ULTIMO);
        expect(prismaMock.usuario.delete).not.toHaveBeenCalled();
    });

    it("exclui ADMIN quando sobra outro ativo", async () => {
        alvo("ADMIN");
        prismaMock.usuario.count.mockResolvedValue(2);
        await service.excluir(ID_OUTRO, ID_ADMIN);
        expect(prismaMock.usuario.delete).toHaveBeenCalledWith({ where: { id: ID_OUTRO } });
    });

    it("exclui VOLUNTARIO sem contar administradores", async () => {
        alvo("VOLUNTARIO");
        await service.excluir(ID_OUTRO, ID_ADMIN);
        expect(prismaMock.usuario.count).not.toHaveBeenCalled();
        expect(prismaMock.usuario.delete).toHaveBeenCalled();
    });
});

describe("usuarioService.trocarSenha", () => {
    let senhaHash: string;
    beforeAll(async () => {
        senhaHash = await bcrypt.hash("senha-atual", 4);
    });

    it("troca a senha quando a atual confere", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ id: ID_OUTRO, ativo: true, senhaHash } as never);

        await service.trocarSenha(ID_OUTRO, "senha-atual", "senha-nova-1");

        const chamada = prismaMock.usuario.update.mock.calls[0]?.[0];
        expect(chamada?.where).toEqual({ id: ID_OUTRO });
        await expect(bcrypt.compare("senha-nova-1", chamada?.data.senhaHash as string)).resolves.toBe(true);
    });

    it("senha atual errada dá 400 (não 401, para não deslogar)", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ id: ID_OUTRO, ativo: true, senhaHash } as never);
        await esperarAppError(service.trocarSenha(ID_OUTRO, "errada", "senha-nova-1"), 400, "Senha atual incorreta.");
        expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it("usuário desativado (com token ainda válido) dá 401", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ id: ID_OUTRO, ativo: false, senhaHash } as never);
        await esperarAppError(service.trocarSenha(ID_OUTRO, "senha-atual", "senha-nova-1"), 401);
        expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it("usuário inexistente dá 401", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue(null);
        await esperarAppError(service.trocarSenha(ID_OUTRO, "senha-atual", "senha-nova-1"), 401);
    });
});
