import { beforeEach, describe, expect, it } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { api, zerarLimites } from "../helpers/app";

const ANIMAL = "44444444-4444-4444-8444-444444444444";
const interesse = { animalId: ANIMAL, nome: "Ana", telefone: "(47) 99999-8888", aceitaContato: true };

beforeEach(zerarLimites);

describe("GET /api/publico/animais", () => {
    it("só consulta animais DISPONIVEL (nunca EM_ESPERA nem ADOTADO) e sem dados internos", async () => {
        prismaMock.animal.findMany.mockResolvedValue([{ id: ANIMAL, nome: "Rex" }] as never);

        const res = await api().get("/api/publico/animais");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ id: ANIMAL, nome: "Rex" }]);
        const consulta = prismaMock.animal.findMany.mock.calls[0]?.[0];
        expect(consulta?.where).toEqual({ status: "DISPONIVEL" });
        expect(consulta?.select).not.toHaveProperty("status");
        expect(consulta?.select).not.toHaveProperty("solicitacoes");
        expect(consulta?.select).not.toHaveProperty("usuarioCadastro");
    });

    it("filtros de espécie e porte não deixam trocar o status", async () => {
        prismaMock.animal.findMany.mockResolvedValue([]);
        await api().get("/api/publico/animais").query({ especie: " gato ", porte: "PEQUENO", status: "ADOTADO" });
        expect(prismaMock.animal.findMany.mock.calls[0]?.[0]?.where).toEqual({
            status: "DISPONIVEL",
            especie: "GATO",
            porte: "PEQUENO",
        });
    });

    it("filtro vazio (?especie=) é ignorado", async () => {
        prismaMock.animal.findMany.mockResolvedValue([]);
        expect((await api().get("/api/publico/animais?especie=&porte=")).status).toBe(200);
        expect(prismaMock.animal.findMany.mock.calls[0]?.[0]?.where).toEqual({ status: "DISPONIVEL" });
    });

    it.each([
        [{ especie: "DRAGAO" }, /Espécie inválida/],
        [{ porte: "GIGANTE" }, /Porte inválido/],
        ["especie=GATO&especie=CACHORRO", /Espécie inválida/],
    ])("filtro inválido %j dá 400", async (query, mensagem) => {
        const res = await api().get("/api/publico/animais").query(query);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(mensagem);
        expect(prismaMock.animal.findMany).not.toHaveBeenCalled();
    });
});

describe("GET /api/publico/eventos e /estatisticas", () => {
    it("lista no máximo 12 eventos de hoje em diante, com data AAAA-MM-DD", async () => {
        prismaMock.evento.findMany.mockResolvedValue([{ id: "e1", data: new Date("2026-10-25T00:00:00.000Z") }] as never);

        const res = await api().get("/api/publico/eventos");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ id: "e1", data: "2026-10-25" }]);
        const consulta = prismaMock.evento.findMany.mock.calls[0]?.[0];
        // relógio falso em 25/10/2026 12h de Brasília
        expect(consulta?.where).toEqual({ data: { gte: new Date("2026-10-25T00:00:00.000Z") } });
        expect(consulta?.take).toBe(12);
        expect(consulta?.select).not.toHaveProperty("criadoPor");
    });

    it("estatísticas trazem só totais", async () => {
        prismaMock.animal.count.mockResolvedValueOnce(7).mockResolvedValueOnce(3);
        prismaMock.doacao.count.mockResolvedValue(20);

        const res = await api().get("/api/publico/estatisticas");
        expect(res.body).toEqual({ animaisAdotados: 7, animaisDisponiveis: 3, doacoesRecebidas: 20 });
    });
});

describe("POST /api/publico/interesses", () => {
    function animalDisponivel() {
        prismaMock.solicitacaoAdocao.findFirst.mockResolvedValue(null);
        prismaMock.animal.updateMany.mockResolvedValue({ count: 1 });
    }

    it("registra o interesse (201) sem devolver dados internos nem os enviados", async () => {
        animalDisponivel();

        const res = await api().post("/api/publico/interesses").send(interesse);

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ mensagem: "Recebemos seu interesse. O abrigo entrará em contato." });
        // telefone normalizado; aceitaContato não é gravado
        expect(prismaMock.solicitacaoAdocao.create.mock.calls[0]?.[0].data).toEqual({
            animalId: ANIMAL,
            nome: "Ana",
            telefone: "47999998888",
        });
    });

    it("animal já reservado dá 409", async () => {
        prismaMock.solicitacaoAdocao.findFirst.mockResolvedValue(null);
        prismaMock.animal.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.animal.findUnique.mockResolvedValue({ id: ANIMAL } as never);

        const res = await api().post("/api/publico/interesses").send(interesse);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: "Este animal já tem alguém interessado no momento." });
    });

    it("telefone com interesse em andamento dá 409", async () => {
        prismaMock.solicitacaoAdocao.findFirst.mockResolvedValue({ id: "s1" } as never);
        const res = await api().post("/api/publico/interesses").send(interesse);
        expect(res.status).toBe(409);
    });

    it("dados inválidos dão 400 com os campos", async () => {
        const res = await api()
            .post("/api/publico/interesses")
            .send({ ...interesse, telefone: "4733334444", aceitaContato: false, status: "APROVADA" });
        expect(res.status).toBe(400);
        expect(Object.keys(res.body.campos).sort()).toEqual(["aceitaContato", "status", "telefone"]);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("a 6ª tentativa na mesma hora dá 429 no formato {error}", async () => {
        animalDisponivel();
        for (let i = 0; i < 5; i++) {
            expect((await api().post("/api/publico/interesses").send(interesse)).status).toBe(201);
        }

        const res = await api().post("/api/publico/interesses").send(interesse);

        expect(res.status).toBe(429);
        expect(res.body).toEqual({ error: "Muitas tentativas de registrar interesse. Tente novamente mais tarde." });
        expect(res.headers["ratelimit-policy"]).toBeDefined();
        expect(prismaMock.solicitacaoAdocao.create).toHaveBeenCalledTimes(5);
    });

    it("tentativas com erro também contam para o limite (evita spam)", async () => {
        for (let i = 0; i < 5; i++) await api().post("/api/publico/interesses").send({});
        expect((await api().post("/api/publico/interesses").send(interesse)).status).toBe(429);
    });
});
