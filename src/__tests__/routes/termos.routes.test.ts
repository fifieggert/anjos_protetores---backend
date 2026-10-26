import { describe, expect, it } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { api } from "../helpers/app";
import { comoAdmin, comoVoluntario } from "../helpers/auth";
import { AGORA } from "../helpers/tempo";
import { erroPrisma } from "../helpers/erros";

const TERMO = "77777777-7777-4777-8777-777777777777";
const ANIMAL = "44444444-4444-4444-8444-444444444444";

const termoParaPdf = {
    id: TERMO,
    geradoEm: new Date(),
    animal: {
        nome: "Totó Açúcar",
        especie: "CACHORRO",
        raca: null,
        idade: 2,
        porte: "PEQUENO",
        sexo: "MACHO",
        castrado: false,
        dataCastracao: null,
        vacinado: false,
        dosesVacina: null,
        dataRevacinacao: null,
        descricao: null,
    },
    solicitacao: { nome: "Ana", telefone: "47999998888" },
    geradoPor: { nome: "Coordenadora" },
};

describe("GET /api/termos-adocao/:id/pdf", () => {
    const pdf = () => api().get(`/api/termos-adocao/${TERMO}/pdf`).buffer(true).responseType("blob");

    it("ADMIN recebe o PDF (application/pdf, sem cache, nome de arquivo seguro)", async () => {
        prismaMock.termoAdocao.findUnique.mockResolvedValue(termoParaPdf as never);

        const res = await pdf().set("Authorization", comoAdmin());

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toBe("application/pdf");
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.headers["content-disposition"]).toBe('inline; filename="termo-adocao-toto-acucar.pdf"');
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect((res.body as Buffer).subarray(0, 5).toString("latin1")).toBe("%PDF-");
        expect(Number(res.headers["content-length"])).toBe((res.body as Buffer).length);
    });

    it("sem token dá 401", async () => {
        expect((await pdf()).status).toBe(401);
        expect(prismaMock.termoAdocao.findUnique).not.toHaveBeenCalled();
    });

    it("VOLUNTARIO dá 403 (o PDF tem nome e telefone do interessado)", async () => {
        expect((await pdf().set("Authorization", comoVoluntario())).status).toBe(403);
        expect(prismaMock.termoAdocao.findUnique).not.toHaveBeenCalled();
    });

    it("termo inexistente dá 404", async () => {
        prismaMock.termoAdocao.findUnique.mockResolvedValue(null);
        const res = await api().get(`/api/termos-adocao/${TERMO}/pdf`).set("Authorization", comoAdmin());
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Termo de adoção não encontrado." });
    });

    it("id inválido dá 400", async () => {
        const res = await api().get("/api/termos-adocao/abc/pdf").set("Authorization", comoAdmin());
        expect(res.status).toBe(400);
    });
});

describe("demais rotas de /api/termos-adocao (ADMIN)", () => {
    it("POST cria (201) ou devolve o existente não assinado (200)", async () => {
        prismaMock.animal.findUnique.mockResolvedValue({ id: ANIMAL } as never);
        prismaMock.termoAdocao.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: TERMO } as never);
        prismaMock.termoAdocao.create.mockResolvedValue({ id: TERMO } as never);

        const novo = await api().post("/api/termos-adocao").set("Authorization", comoAdmin()).send({ animalId: ANIMAL });
        const repetido = await api().post("/api/termos-adocao").set("Authorization", comoAdmin()).send({ animalId: ANIMAL });

        expect(novo.status).toBe(201);
        expect(repetido.status).toBe(200);
        expect(repetido.body).toEqual({ id: TERMO });
        expect(prismaMock.termoAdocao.create).toHaveBeenCalledTimes(1);
    });

    it("POST não aceita geradoPorId do corpo", async () => {
        const res = await api()
            .post("/api/termos-adocao")
            .set("Authorization", comoAdmin())
            .send({ animalId: ANIMAL, geradoPorId: ANIMAL });
        expect(res.status).toBe(400);
    });

    it("PUT assinado sem data usa o momento atual; desfazer limpa a data", async () => {
        prismaMock.termoAdocao.update.mockResolvedValue({ id: TERMO } as never);

        await api().put(`/api/termos-adocao/${TERMO}`).set("Authorization", comoAdmin()).send({ assinado: true });
        await api().put(`/api/termos-adocao/${TERMO}`).set("Authorization", comoAdmin()).send({ assinado: false });

        expect(prismaMock.termoAdocao.update.mock.calls[0]?.[0].data).toEqual({ assinado: true, assinadoEm: AGORA });
        expect(prismaMock.termoAdocao.update.mock.calls[1]?.[0].data).toEqual({ assinado: false, assinadoEm: null });
    });

    it("GET lista, GET por id (404) e DELETE (204)", async () => {
        prismaMock.termoAdocao.findMany.mockResolvedValue([]);
        prismaMock.termoAdocao.findUnique.mockResolvedValueOnce({ id: TERMO } as never).mockResolvedValueOnce(null);

        expect((await api().get("/api/termos-adocao").set("Authorization", comoAdmin())).body).toEqual([]);
        expect((await api().get(`/api/termos-adocao/${TERMO}`).set("Authorization", comoAdmin())).status).toBe(200);
        expect((await api().get(`/api/termos-adocao/${TERMO}`).set("Authorization", comoAdmin())).status).toBe(404);
        expect((await api().delete(`/api/termos-adocao/${TERMO}`).set("Authorization", comoAdmin())).status).toBe(204);
    });

    it("DELETE de termo inexistente (P2025) dá 404", async () => {
        prismaMock.termoAdocao.delete.mockRejectedValue(erroPrisma("P2025"));
        const res = await api().delete(`/api/termos-adocao/${TERMO}`).set("Authorization", comoAdmin());
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Registro não encontrado." });
    });
});
