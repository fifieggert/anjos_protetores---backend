import { describe, expect, it } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { api } from "../helpers/app";
import { ID_VOLUNTARIO, comoAdmin, comoVoluntario } from "../helpers/auth";

const ANIMAL = "44444444-4444-4444-8444-444444444444";

describe("/api/animais", () => {
    it("sem token dá 401 (a listagem completa é interna)", async () => {
        expect((await api().get("/api/animais")).status).toBe(401);
    });

    it("VOLUNTARIO cadastra animal: quem cadastrou vem do token", async () => {
        prismaMock.animal.create.mockResolvedValue({ id: ANIMAL } as never);

        const res = await api()
            .post("/api/animais")
            .set("Authorization", comoVoluntario())
            .send({ nome: "Rex", especie: "CACHORRO", porte: "MEDIO" });

        expect(res.status).toBe(201);
        expect(prismaMock.animal.create.mock.calls[0]?.[0].data).toEqual({
            nome: "Rex",
            especie: "CACHORRO",
            porte: "MEDIO",
            usuarioCadastro: { connect: { id: ID_VOLUNTARIO } },
        });
    });

    it("cadastro já como ADOTADO dá 400", async () => {
        const res = await api()
            .post("/api/animais")
            .set("Authorization", comoAdmin())
            .send({ nome: "Rex", especie: "CACHORRO", porte: "MEDIO", status: "ADOTADO" });
        expect(res.status).toBe(400);
        expect(prismaMock.animal.create).not.toHaveBeenCalled();
    });

    it("lista e busca por id (404 quando não existe), sem dados dos interessados", async () => {
        prismaMock.animal.findMany.mockResolvedValue([]);
        prismaMock.animal.findUnique.mockResolvedValueOnce({ id: ANIMAL } as never).mockResolvedValueOnce(null);

        expect((await api().get("/api/animais").set("Authorization", comoVoluntario())).status).toBe(200);
        expect(prismaMock.animal.findMany.mock.calls[0]?.[0]?.select).not.toHaveProperty("solicitacoes");
        expect((await api().get(`/api/animais/${ANIMAL}`).set("Authorization", comoVoluntario())).status).toBe(200);
        const ausente = await api().get(`/api/animais/${ANIMAL}`).set("Authorization", comoVoluntario());
        expect(ausente.status).toBe(404);
        expect(ausente.body).toEqual({ error: "Animal não encontrado." });
    });

    it("PUT com status EM_ESPERA dá 400 (regra do animalService)", async () => {
        prismaMock.animal.findUnique.mockResolvedValue({ status: "DISPONIVEL", castrado: false, vacinado: false } as never);
        const res = await api().put(`/api/animais/${ANIMAL}`).set("Authorization", comoAdmin()).send({ status: "EM_ESPERA" });
        expect(res.status).toBe(400);
        expect(res.body.campos).toHaveProperty("status");
    });

    it("PUT válido devolve o animal", async () => {
        prismaMock.animal.findUnique.mockResolvedValue({ status: "ADOTADO", castrado: false, vacinado: false } as never);
        prismaMock.animal.update.mockResolvedValue({ id: ANIMAL, status: "DISPONIVEL" } as never);
        const res = await api().put(`/api/animais/${ANIMAL}`).set("Authorization", comoAdmin()).send({ status: "DISPONIVEL" });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: ANIMAL, status: "DISPONIVEL" });
    });

    it("DELETE só para ADMIN", async () => {
        expect((await api().delete(`/api/animais/${ANIMAL}`).set("Authorization", comoVoluntario())).status).toBe(403);
        expect((await api().delete(`/api/animais/${ANIMAL}`).set("Authorization", comoAdmin())).status).toBe(200);
        expect(prismaMock.animal.delete).toHaveBeenCalledTimes(1);
    });
});
