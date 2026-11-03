import { describe, expect, it } from "vitest";
import { mockGroupBy, prismaMock } from "../helpers/prisma";
import { api } from "../helpers/app";
import { comoAdmin, comoVoluntario } from "../helpers/auth";

function bancoVazio() {
    mockGroupBy(prismaMock.animal.groupBy).mockResolvedValue([] as never);
    mockGroupBy(prismaMock.solicitacaoAdocao.groupBy).mockResolvedValue([] as never);
    prismaMock.solicitacaoAdocao.count.mockResolvedValue(0);
    prismaMock.itemEstoque.findMany.mockResolvedValue([]);
    prismaMock.doacao.count.mockResolvedValue(0);
    prismaMock.doacao.findMany.mockResolvedValue([]);
    prismaMock.evento.findMany.mockResolvedValue([]);
}

describe("GET /api/dashboard", () => {
    it("sem token dá 401 e não consulta o banco", async () => {
        const res = await api().get("/api/dashboard");
        expect(res.status).toBe(401);
        expect(prismaMock.animal.groupBy).not.toHaveBeenCalled();
    });

    it("VOLUNTARIO dá 403 e não consulta o banco", async () => {
        const res = await api().get("/api/dashboard").set("Authorization", comoVoluntario());
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Você não tem permissão para acessar este recurso." });
        expect(prismaMock.animal.groupBy).not.toHaveBeenCalled();
    });

    it("ADMIN recebe 200 com as cinco seções do painel, sem cache", async () => {
        bancoVazio();

        const res = await api().get("/api/dashboard").set("Authorization", comoAdmin());

        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(Object.keys(res.body)).toEqual(["animais", "adocoes", "estoque", "doacoes", "eventos"]);
        expect(res.body.animais.porStatus).toEqual({ DISPONIVEL: 0, EM_TRATAMENTO: 0, EM_ESPERA: 0, ADOTADO: 0 });
        expect(res.body.adocoes.porMes).toHaveLength(6);
    });

    it("erro inesperado do banco vira 500 genérico (tratamento padrão de erros)", async () => {
        bancoVazio();
        prismaMock.doacao.count.mockRejectedValue(new Error("conexão perdida com 10.0.0.5"));

        const res = await api().get("/api/dashboard").set("Authorization", comoAdmin());

        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toContain("10.0.0.5");
    });
});
