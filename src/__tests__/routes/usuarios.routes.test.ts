import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { api, zerarLimites } from "../helpers/app";
import { ID_ADMIN, ID_OUTRO, ID_VOLUNTARIO, comoAdmin, comoVoluntario } from "../helpers/auth";
import { erroPrisma } from "../helpers/erros";

beforeEach(zerarLimites);

const novoUsuario = {
    nome: "Maria",
    cpf: "529.982.247-25",
    email: "Maria@Abrigo.org",
    senha: "senha-forte",
    perfil: "VOLUNTARIO",
};

describe("acesso a /api/usuarios", () => {
    it("sem token dá 401", async () => {
        expect((await api().get("/api/usuarios")).status).toBe(401);
    });

    it.each([
        ["GET", "/api/usuarios"],
        ["POST", "/api/usuarios"],
        ["GET", `/api/usuarios/${ID_OUTRO}`],
        ["GET", "/api/usuarios/email/a@b.com"],
        ["PUT", `/api/usuarios/${ID_OUTRO}`],
        ["DELETE", `/api/usuarios/${ID_OUTRO}`],
    ])("VOLUNTARIO em %s %s dá 403", async (metodo, rota) => {
        const req = api()[metodo.toLowerCase() as "get"](rota).set("Authorization", comoVoluntario());
        const res = await req.send({});
        expect(res.status).toBe(403);
        expect(prismaMock.usuario.findMany).not.toHaveBeenCalled();
        expect(prismaMock.usuario.create).not.toHaveBeenCalled();
    });

    it("ADMIN lista os usuários", async () => {
        prismaMock.usuario.findMany.mockResolvedValue([{ id: ID_ADMIN }] as never);
        const res = await api().get("/api/usuarios").set("Authorization", comoAdmin());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ id: ID_ADMIN }]);
        expect(prismaMock.usuario.findMany.mock.calls[0]?.[0]?.select).not.toHaveProperty("senhaHash");
    });
});

describe("CRUD de usuários (ADMIN)", () => {
    it("cria usuário gravando só o hash da senha e o CPF só com dígitos", async () => {
        prismaMock.usuario.create.mockResolvedValue({ id: ID_OUTRO } as never);

        const res = await api().post("/api/usuarios").set("Authorization", comoAdmin()).send(novoUsuario);

        expect(res.status).toBe(201);
        const data = prismaMock.usuario.create.mock.calls[0]?.[0].data as Record<string, unknown>;
        expect(data).not.toHaveProperty("senha");
        expect(data).toMatchObject({ cpf: "52998224725", email: "maria@abrigo.org", perfil: "VOLUNTARIO" });
        await expect(bcrypt.compare("senha-forte", data["senhaHash"] as string)).resolves.toBe(true);
    });

    it("perfil FUNCIONARIO dá 400", async () => {
        const res = await api()
            .post("/api/usuarios")
            .set("Authorization", comoAdmin())
            .send({ ...novoUsuario, perfil: "FUNCIONARIO" });
        expect(res.status).toBe(400);
        expect(res.body.campos.perfil).toMatch(/Perfil inválido/);
    });

    it("e-mail repetido (P2002) dá 409", async () => {
        prismaMock.usuario.create.mockRejectedValue(erroPrisma("P2002", { target: ["email"] }));
        const res = await api().post("/api/usuarios").set("Authorization", comoAdmin()).send(novoUsuario);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: "Já existe um cadastro com este e-mail." });
    });

    it("busca por id e por e-mail, com 404 quando não existe", async () => {
        prismaMock.usuario.findUnique.mockResolvedValueOnce({ id: ID_OUTRO } as never).mockResolvedValue(null);
        expect((await api().get(`/api/usuarios/${ID_OUTRO}`).set("Authorization", comoAdmin())).status).toBe(200);
        expect((await api().get(`/api/usuarios/${ID_OUTRO}`).set("Authorization", comoAdmin())).status).toBe(404);
        expect((await api().get("/api/usuarios/email/x@y.com").set("Authorization", comoAdmin())).status).toBe(404);

        prismaMock.usuario.findUnique.mockResolvedValue({ id: ID_OUTRO } as never);
        expect((await api().get("/api/usuarios/email/x@y.com").set("Authorization", comoAdmin())).status).toBe(200);
    });

    it("id inválido dá 400", async () => {
        const res = await api().get("/api/usuarios/123").set("Authorization", comoAdmin());
        expect(res.status).toBe(400);
        expect(res.body.campos).toEqual({ id: "Identificador inválido." });
    });

    it("não deixa desativar o último ADMIN", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ perfil: "ADMIN", ativo: true } as never);
        prismaMock.usuario.count.mockResolvedValue(0);

        const res = await api().put(`/api/usuarios/${ID_OUTRO}`).set("Authorization", comoAdmin()).send({ ativo: false });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/último administrador ativo/);
    });

    it("atualiza outro usuário", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ perfil: "VOLUNTARIO", ativo: true } as never);
        prismaMock.usuario.update.mockResolvedValue({ id: ID_OUTRO, nome: "Novo" } as never);
        const res = await api().put(`/api/usuarios/${ID_OUTRO}`).set("Authorization", comoAdmin()).send({ nome: "Novo" });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: ID_OUTRO, nome: "Novo" });
    });

    it("não deixa excluir a si mesmo; exclui outro", async () => {
        const proprio = await api().delete(`/api/usuarios/${ID_ADMIN}`).set("Authorization", comoAdmin());
        expect(proprio.status).toBe(409);

        prismaMock.usuario.findUnique.mockResolvedValue({ perfil: "VOLUNTARIO", ativo: true } as never);
        const outro = await api().delete(`/api/usuarios/${ID_OUTRO}`).set("Authorization", comoAdmin());
        expect(outro.status).toBe(200);
    });

    it("usuário com registros vinculados (P2003) não é excluído: 409", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ perfil: "VOLUNTARIO", ativo: true } as never);
        prismaMock.usuario.delete.mockRejectedValue(erroPrisma("P2003"));
        const res = await api().delete(`/api/usuarios/${ID_OUTRO}`).set("Authorization", comoAdmin());
        expect(res.status).toBe(409);
    });
});

describe("PATCH /api/usuarios/me/senha", () => {
    let senhaHash: string;
    beforeEach(async () => {
        senhaHash ??= await bcrypt.hash("senha-atual", 4);
    });

    const trocar = (corpo: object, autorizacao = comoVoluntario()) =>
        api().patch("/api/usuarios/me/senha").set("Authorization", autorizacao).send(corpo);

    it("VOLUNTARIO troca a própria senha (204) e o id vem do token", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ id: ID_VOLUNTARIO, ativo: true, senhaHash } as never);

        const res = await trocar({ senhaAtual: "senha-atual", novaSenha: "senha-nova-1" });

        expect(res.status).toBe(204);
        expect(prismaMock.usuario.findUnique.mock.calls[0]?.[0].where).toEqual({ id: ID_VOLUNTARIO });
        expect(prismaMock.usuario.update.mock.calls[0]?.[0].where).toEqual({ id: ID_VOLUNTARIO });
    });

    it("senha atual errada dá 400", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ id: ID_VOLUNTARIO, ativo: true, senhaHash } as never);
        const res = await trocar({ senhaAtual: "errada", novaSenha: "senha-nova-1" });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Senha atual incorreta." });
    });

    it("nova senha igual à atual dá 400 sem consultar o banco", async () => {
        const res = await trocar({ senhaAtual: "senha-atual", novaSenha: "senha-atual" });
        expect(res.status).toBe(400);
        expect(res.body.campos).toEqual({ novaSenha: "A nova senha deve ser diferente da atual." });
        expect(prismaMock.usuario.findUnique).not.toHaveBeenCalled();
    });

    it("usuário desativado dá 401", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ id: ID_VOLUNTARIO, ativo: false, senhaHash } as never);
        expect((await trocar({ senhaAtual: "senha-atual", novaSenha: "senha-nova-1" })).status).toBe(401);
    });

    it("sem token dá 401", async () => {
        const res = await api().patch("/api/usuarios/me/senha").send({ senhaAtual: "a", novaSenha: "senha-nova-1" });
        expect(res.status).toBe(401);
    });

    it("depois de 10 erros em 15 minutos dá 429", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue({ id: ID_VOLUNTARIO, ativo: true, senhaHash } as never);
        for (let i = 0; i < 10; i++) {
            expect((await trocar({ senhaAtual: "errada", novaSenha: "senha-nova-1" })).status).toBe(400);
        }
        const res = await trocar({ senhaAtual: "senha-atual", novaSenha: "senha-nova-1" });
        expect(res.status).toBe(429);
        expect(res.body).toEqual({ error: "Muitas tentativas de trocar a senha. Tente novamente em alguns minutos." });
    });
});
