import { describe, expect, it } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { api } from "../helpers/app";
import { comoAdmin, comoVoluntario } from "../helpers/auth";

const SOLICITACAO = "66666666-6666-4666-8666-666666666666";
const ANIMAL = "44444444-4444-4444-8444-444444444444";
const UM_DIA = 24 * 60 * 60 * 1000;
// relógio falso: 25/10/2026 15:00Z
const criadaHa = (ms: number) => ({ id: SOLICITACAO, criadoEm: new Date(Date.now() - ms) });

describe("/api/solicitacoes-adocao", () => {
    it("VOLUNTARIO dá 403 (tem nome e telefone dos interessados)", async () => {
        expect((await api().get("/api/solicitacoes-adocao").set("Authorization", comoVoluntario())).status).toBe(403);
        expect(prismaMock.solicitacaoAdocao.findMany).not.toHaveBeenCalled();
    });

    it("lista com filtros e dias completos desde a criação", async () => {
        prismaMock.solicitacaoAdocao.findMany.mockResolvedValue([
            criadaHa(2 * UM_DIA + 1000),
            criadaHa(UM_DIA - 1000),
            criadaHa(-5000), // relógio do banco adiantado: nunca negativo
        ] as never);

        const res = await api()
            .get("/api/solicitacoes-adocao")
            .query({ animalId: ANIMAL, status: "PENDENTE" })
            .set("Authorization", comoAdmin());

        expect(res.status).toBe(200);
        expect(res.body.map((s: { diasDesdeCriacao: number }) => s.diasDesdeCriacao)).toEqual([2, 0, 0]);
        expect(prismaMock.solicitacaoAdocao.findMany.mock.calls[0]?.[0]?.where).toEqual({ animalId: ANIMAL, status: "PENDENTE" });
    });

    it("sem filtros consulta tudo; filtro inválido dá 400", async () => {
        prismaMock.solicitacaoAdocao.findMany.mockResolvedValue([]);
        await api().get("/api/solicitacoes-adocao").set("Authorization", comoAdmin());
        expect(prismaMock.solicitacaoAdocao.findMany.mock.calls[0]?.[0]?.where).toEqual({});
        expect((await api().get("/api/solicitacoes-adocao?status=X").set("Authorization", comoAdmin())).status).toBe(400);
    });

    it("busca por id com 404", async () => {
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValueOnce(criadaHa(0) as never).mockResolvedValueOnce(null);
        expect((await api().get(`/api/solicitacoes-adocao/${SOLICITACAO}`).set("Authorization", comoAdmin())).body.diasDesdeCriacao).toBe(0);
        expect((await api().get(`/api/solicitacoes-adocao/${SOLICITACAO}`).set("Authorization", comoAdmin())).status).toBe(404);
    });

    it("PATCH só aceita EM_CONTATO", async () => {
        const res = await api()
            .patch(`/api/solicitacoes-adocao/${SOLICITACAO}`)
            .set("Authorization", comoAdmin())
            .send({ status: "APROVADA" });
        expect(res.status).toBe(400);

        prismaMock.solicitacaoAdocao.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.solicitacaoAdocao.findUniqueOrThrow.mockResolvedValue(criadaHa(0) as never);
        const ok = await api()
            .patch(`/api/solicitacoes-adocao/${SOLICITACAO}`)
            .set("Authorization", comoAdmin())
            .send({ status: "EM_CONTATO" });
        expect(ok.status).toBe(200);
    });

    it.each(["concluir", "cancelar"])("POST /:id/%s encerra a solicitação", async (acao) => {
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue({ id: SOLICITACAO, animalId: ANIMAL, status: "EM_CONTATO" } as never);
        prismaMock.solicitacaoAdocao.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.animal.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.solicitacaoAdocao.findUniqueOrThrow.mockResolvedValue(criadaHa(0) as never);

        const res = await api().post(`/api/solicitacoes-adocao/${SOLICITACAO}/${acao}`).set("Authorization", comoAdmin());
        expect(res.status).toBe(200);
    });

    it("concluir solicitação já encerrada dá 409", async () => {
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue({ id: SOLICITACAO, animalId: ANIMAL, status: "APROVADA" } as never);
        prismaMock.solicitacaoAdocao.updateMany.mockResolvedValue({ count: 0 });
        const res = await api().post(`/api/solicitacoes-adocao/${SOLICITACAO}/concluir`).set("Authorization", comoAdmin());
        expect(res.status).toBe(409);
    });

    it("DELETE devolve o animal e exclui", async () => {
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue({ id: SOLICITACAO, animalId: ANIMAL, status: "PENDENTE" } as never);
        const res = await api().delete(`/api/solicitacoes-adocao/${SOLICITACAO}`).set("Authorization", comoAdmin());
        expect(res.status).toBe(200);
        expect(prismaMock.animal.updateMany).toHaveBeenCalled();
        expect(prismaMock.solicitacaoAdocao.delete).toHaveBeenCalled();
    });
});
