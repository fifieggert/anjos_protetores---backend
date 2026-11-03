import { describe, expect, it } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { api } from "../helpers/app";
import { ID_ADMIN, comoAdmin, comoVoluntario } from "../helpers/auth";

const EVENTO = "99999999-9999-4999-8999-999999999999";
const HOJE = new Date("2026-10-25T00:00:00.000Z");
const evento = { titulo: "Feira de adoção", data: "2026-11-14T15:00:00.000Z", horarioInicio: "09:00", local: "Praça" };
const gravado = { id: EVENTO, titulo: "Feira de adoção", data: new Date("2026-11-14T00:00:00.000Z") };

describe("/api/eventos", () => {
    it("VOLUNTARIO dá 403 e sem token dá 401", async () => {
        expect((await api().get("/api/eventos").set("Authorization", comoVoluntario())).status).toBe(403);
        expect((await api().post("/api/eventos").send(evento)).status).toBe(401);
        expect(prismaMock.evento.findMany).not.toHaveBeenCalled();
    });

    it("ADMIN cria evento: quem criou vem do token e a data sai como AAAA-MM-DD", async () => {
        prismaMock.evento.create.mockResolvedValue(gravado as never);

        const res = await api().post("/api/eventos").set("Authorization", comoAdmin()).send(evento);

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ ...gravado, data: "2026-11-14" });
        expect(prismaMock.evento.create.mock.calls[0]?.[0].data).toMatchObject({
            data: new Date("2026-11-14T00:00:00.000Z"),
            criadoPor: { connect: { id: ID_ADMIN } },
        });
    });

    it("criação com horário de fim antes do início dá 400", async () => {
        const res = await api()
            .post("/api/eventos")
            .set("Authorization", comoAdmin())
            .send({ ...evento, horarioFim: "08:00" });
        expect(res.status).toBe(400);
        expect(res.body.campos).toEqual({ horarioFim: "O horário de término deve ser depois do horário de início." });
    });

    it.each([
        ["proximos", { data: { gte: HOJE } }],
        ["passados", { data: { lt: HOJE } }],
        ["todos", {}],
    ])("listagem com período %s", async (periodo, where) => {
        prismaMock.evento.findMany.mockResolvedValue([gravado] as never);
        const res = await api().get("/api/eventos").query({ periodo }).set("Authorization", comoAdmin());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ ...gravado, data: "2026-11-14" }]);
        expect(prismaMock.evento.findMany.mock.calls[0]?.[0]?.where).toEqual(where);
    });

    it("período inválido dá 400", async () => {
        const res = await api().get("/api/eventos?periodo=ontem").set("Authorization", comoAdmin());
        expect(res.status).toBe(400);
    });

    it("GET por id: 200 e 404", async () => {
        prismaMock.evento.findUnique.mockResolvedValueOnce(gravado as never).mockResolvedValueOnce(null);
        const achado = await api().get(`/api/eventos/${EVENTO}`).set("Authorization", comoAdmin());
        expect(achado.body.data).toBe("2026-11-14");
        expect((await api().get(`/api/eventos/${EVENTO}`).set("Authorization", comoAdmin())).status).toBe(404);
    });

    it("PUT com só o fim antes do início gravado dá 400; válido dá 200", async () => {
        prismaMock.evento.findUnique.mockResolvedValue({ horarioInicio: "09:00", horarioFim: null } as never);
        prismaMock.evento.update.mockResolvedValue(gravado as never);

        const invalido = await api().put(`/api/eventos/${EVENTO}`).set("Authorization", comoAdmin()).send({ horarioFim: "08:00" });
        const valido = await api().put(`/api/eventos/${EVENTO}`).set("Authorization", comoAdmin()).send({ horarioFim: "10:00" });

        expect(invalido.status).toBe(400);
        expect(valido.status).toBe(200);
    });

    it("DELETE remove", async () => {
        const res = await api().delete(`/api/eventos/${EVENTO}`).set("Authorization", comoAdmin());
        expect(res.status).toBe(200);
        expect(prismaMock.evento.delete).toHaveBeenCalledWith({ where: { id: EVENTO } });
    });
});
