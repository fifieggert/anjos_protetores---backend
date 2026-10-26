import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { api } from "../helpers/app";
import { ID_ADMIN } from "../helpers/auth";

const CREDENCIAIS_INVALIDAS = { error: "E-mail ou senha incorretos." };
let senhaHash: string;

beforeAll(async () => {
    senhaHash = await bcrypt.hash("senha-correta", 4);
});

function usuarioGravado(dados: { ativo?: boolean } = {}) {
    prismaMock.usuario.findUnique.mockResolvedValue({
        id: ID_ADMIN,
        nome: "Coordenadora",
        cpf: "52998224725",
        email: "admin@abrigo.org",
        perfil: "ADMIN",
        ativo: true,
        criadoEm: new Date(),
        senhaHash,
        ...dados,
    } as never);
}

describe("POST /api/auth/login", () => {
    it("credenciais certas devolvem token de 30 min e o usuário sem senhaHash", async () => {
        usuarioGravado();

        const res = await api().post("/api/auth/login").send({ email: "  Admin@Abrigo.ORG ", senha: "senha-correta" });

        expect(res.status).toBe(200);
        expect(res.body.usuario).toEqual({ id: ID_ADMIN, nome: "Coordenadora", email: "admin@abrigo.org", perfil: "ADMIN" });
        expect(JSON.stringify(res.body)).not.toContain("senhaHash");
        // o e-mail é procurado normalizado
        expect(prismaMock.usuario.findUnique.mock.calls[0]?.[0].where).toEqual({ email: "admin@abrigo.org" });

        const payload = jwt.verify(res.body.token, process.env["JWT_SECRET"] as string) as jwt.JwtPayload;
        expect(payload).toMatchObject({ id: ID_ADMIN, perfil: "ADMIN" });
        expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(30 * 60);
    });

    it("senha errada dá 401 com mensagem genérica", async () => {
        usuarioGravado();
        const res = await api().post("/api/auth/login").send({ email: "admin@abrigo.org", senha: "errada" });
        expect(res.status).toBe(401);
        expect(res.body).toEqual(CREDENCIAIS_INVALIDAS);
    });

    it("usuário inativo não entra, mesmo com a senha certa", async () => {
        usuarioGravado({ ativo: false });
        const res = await api().post("/api/auth/login").send({ email: "admin@abrigo.org", senha: "senha-correta" });
        expect(res.status).toBe(401);
        expect(res.body).toEqual(CREDENCIAIS_INVALIDAS);
    });

    it("e-mail inexistente dá a mesma resposta (não revela quem está cadastrado)", async () => {
        prismaMock.usuario.findUnique.mockResolvedValue(null);
        const res = await api().post("/api/auth/login").send({ email: "ninguem@abrigo.org", senha: "qualquer" });
        expect(res.status).toBe(401);
        expect(res.body).toEqual(CREDENCIAIS_INVALIDAS);
    });

    it("corpo inválido dá 400 sem consultar o banco", async () => {
        const res = await api().post("/api/auth/login").send({ email: "x" });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Dados inválidos.", campos: { email: "E-mail inválido.", senha: "Informe a senha." } });
        expect(prismaMock.usuario.findUnique).not.toHaveBeenCalled();
    });

    it("JSON malformado dá 400", async () => {
        const res = await api().post("/api/auth/login").set("Content-Type", "application/json").send("{email:");
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "JSON inválido no corpo da requisição." });
    });
});

describe("app", () => {
    it("GET /health responde ok", async () => {
        const res = await api().get("/health");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok" });
    });

    it("rota inexistente dá 404 no formato {error}", async () => {
        const res = await api().get("/api/nao-existe");
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Rota não encontrada." });
    });
});
