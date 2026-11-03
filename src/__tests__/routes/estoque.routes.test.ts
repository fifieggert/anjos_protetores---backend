import { describe, expect, it } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { api } from "../helpers/app";
import { ID_ADMIN, ID_VOLUNTARIO, comoAdmin, comoVoluntario } from "../helpers/auth";

const ITEM = "55555555-5555-4555-8555-555555555555";
const REGISTRO = "77777777-7777-4777-8777-777777777777";
const item = (quantidadeAtual: number, quantidadeMinima: number) => ({ id: ITEM, nomeItem: "Ração", quantidadeAtual, quantidadeMinima });

describe("/api/itens-estoque", () => {
    it("alerta de estoque baixo só com quantidadeMinima > 0 e atual < mínima", async () => {
        prismaMock.itemEstoque.findMany.mockResolvedValue([item(2, 5), item(5, 5), item(0, 0), item(9, 5)] as never);

        const res = await api().get("/api/itens-estoque").set("Authorization", comoVoluntario());

        expect(res.status).toBe(200);
        expect(res.body.map((i: { abaixoDoMinimo: boolean }) => i.abaixoDoMinimo)).toEqual([true, false, false, false]);
    });

    it("GET /alertas compara as colunas no banco (mínima > 0)", async () => {
        prismaMock.itemEstoque.findMany.mockResolvedValue([item(1, 3)] as never);

        const res = await api().get("/api/itens-estoque/alertas").set("Authorization", comoVoluntario());

        expect(res.status).toBe(200);
        expect(res.body[0].abaixoDoMinimo).toBe(true);
        expect(prismaMock.itemEstoque.findMany.mock.calls[0]?.[0]?.where).toMatchObject({ quantidadeMinima: { gt: 0 } });
    });

    it("cadastrar item é só do ADMIN", async () => {
        const corpo = { nomeItem: "Ração", categoria: "RACAO", quantidadeMinima: 5 };
        prismaMock.itemEstoque.create.mockResolvedValue(item(0, 5) as never);

        expect((await api().post("/api/itens-estoque").set("Authorization", comoVoluntario()).send(corpo)).status).toBe(403);
        const res = await api().post("/api/itens-estoque").set("Authorization", comoAdmin()).send(corpo);
        expect(res.status).toBe(201);
        expect(res.body.abaixoDoMinimo).toBe(true);
    });

    it("busca por id (404), edita e exclui", async () => {
        prismaMock.itemEstoque.findUnique.mockResolvedValueOnce(item(3, 0) as never).mockResolvedValueOnce(null);
        prismaMock.itemEstoque.update.mockResolvedValue(item(3, 4) as never);

        expect((await api().get(`/api/itens-estoque/${ITEM}`).set("Authorization", comoAdmin())).body.abaixoDoMinimo).toBe(false);
        expect((await api().get(`/api/itens-estoque/${ITEM}`).set("Authorization", comoAdmin())).status).toBe(404);
        const editado = await api().put(`/api/itens-estoque/${ITEM}`).set("Authorization", comoAdmin()).send({ quantidadeMinima: 4 });
        expect(editado.body.abaixoDoMinimo).toBe(true);
        expect((await api().delete(`/api/itens-estoque/${ITEM}`).set("Authorization", comoAdmin())).status).toBe(200);
    });
});

describe("/api/doacoes", () => {
    it("VOLUNTARIO registra doação: usuário do token e saldo somado", async () => {
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.doacao.create.mockResolvedValue({ id: REGISTRO } as never);

        const res = await api().post("/api/doacoes").set("Authorization", comoVoluntario()).send({ itemId: ITEM, quantidade: 3 });

        expect(res.status).toBe(201);
        expect(prismaMock.doacao.create.mock.calls[0]?.[0].data).toEqual({
            itemId: ITEM,
            quantidade: 3,
            doador: "Anônimo",
            usuarioId: ID_VOLUNTARIO,
        });
    });

    it("listar, buscar (404) e editar", async () => {
        prismaMock.doacao.findMany.mockResolvedValue([]);
        prismaMock.doacao.findUnique.mockResolvedValueOnce({ id: REGISTRO } as never).mockResolvedValueOnce(null);
        prismaMock.doacao.update.mockResolvedValue({ id: REGISTRO, doador: "João" } as never);

        expect((await api().get("/api/doacoes").set("Authorization", comoVoluntario())).status).toBe(200);
        expect((await api().get(`/api/doacoes/${REGISTRO}`).set("Authorization", comoVoluntario())).status).toBe(200);
        expect((await api().get(`/api/doacoes/${REGISTRO}`).set("Authorization", comoVoluntario())).status).toBe(404);
        expect((await api().put(`/api/doacoes/${REGISTRO}`).set("Authorization", comoVoluntario()).send({ doador: "João" })).status).toBe(403);
        expect((await api().put(`/api/doacoes/${REGISTRO}`).set("Authorization", comoAdmin()).send({ doador: "João" })).status).toBe(200);
    });

    it("excluir doação que deixaria o saldo negativo dá 409", async () => {
        prismaMock.doacao.findUnique.mockResolvedValue({ itemId: ITEM, quantidade: 10 } as never);
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 0 });
        const res = await api().delete(`/api/doacoes/${REGISTRO}`).set("Authorization", comoAdmin());
        expect(res.status).toBe(409);
    });

    it("excluir doação ajusta o saldo", async () => {
        prismaMock.doacao.findUnique.mockResolvedValue({ itemId: ITEM, quantidade: 10 } as never);
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 1 });
        expect((await api().delete(`/api/doacoes/${REGISTRO}`).set("Authorization", comoAdmin())).status).toBe(200);
    });
});

describe("/api/saidas-estoque", () => {
    it("é só do ADMIN", async () => {
        expect((await api().get("/api/saidas-estoque").set("Authorization", comoVoluntario())).status).toBe(403);
    });

    it("saída maior que o saldo dá 409 com o disponível", async () => {
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.itemEstoque.findUnique.mockResolvedValue({ quantidadeAtual: 2 } as never);

        const res = await api()
            .post("/api/saidas-estoque")
            .set("Authorization", comoAdmin())
            .send({ itemId: ITEM, quantidade: 5, finalidade: "Canil" });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: "Estoque insuficiente. Disponível: 2." });
    });

    it("registra saída, lista, busca (404), edita e exclui devolvendo o saldo", async () => {
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.saidaEstoque.create.mockResolvedValue({ id: REGISTRO } as never);
        prismaMock.saidaEstoque.findMany.mockResolvedValue([]);
        prismaMock.saidaEstoque.update.mockResolvedValue({ id: REGISTRO } as never);

        const criada = await api()
            .post("/api/saidas-estoque")
            .set("Authorization", comoAdmin())
            .send({ itemId: ITEM, quantidade: 1, finalidade: "Canil" });
        expect(criada.status).toBe(201);
        expect(prismaMock.saidaEstoque.create.mock.calls[0]?.[0].data).toMatchObject({ usuarioId: ID_ADMIN });

        expect((await api().get("/api/saidas-estoque").set("Authorization", comoAdmin())).status).toBe(200);
        prismaMock.saidaEstoque.findUnique.mockResolvedValueOnce({ id: REGISTRO } as never).mockResolvedValueOnce(null);
        expect((await api().get(`/api/saidas-estoque/${REGISTRO}`).set("Authorization", comoAdmin())).status).toBe(200);
        expect((await api().get(`/api/saidas-estoque/${REGISTRO}`).set("Authorization", comoAdmin())).status).toBe(404);
        expect(
            (await api().put(`/api/saidas-estoque/${REGISTRO}`).set("Authorization", comoAdmin()).send({ finalidade: "Gatil" })).status,
        ).toBe(200);

        prismaMock.saidaEstoque.findUnique.mockResolvedValue({ itemId: ITEM, quantidade: 1 } as never);
        expect((await api().delete(`/api/saidas-estoque/${REGISTRO}`).set("Authorization", comoAdmin())).status).toBe(200);
        expect(prismaMock.itemEstoque.update).toHaveBeenCalledWith({
            where: { id: ITEM },
            data: { quantidadeAtual: { increment: 1 } },
        });
    });
});
