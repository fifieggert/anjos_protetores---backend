import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type appCarregado from "../../app";
import { prismaMock } from "../helpers/prisma";

const ANIMAL = "44444444-4444-4444-8444-444444444444";
const interesse = { animalId: ANIMAL, nome: "Ana", telefone: "47999998888", aceitaContato: true };

// O app lê TRUST_PROXY ao ser importado: cada teste carrega uma cópia nova do app
// (e dos limitadores, que contam em memória) com o valor desejado.
async function appCom(trustProxy: string | undefined) {
    if (trustProxy === undefined) delete process.env["TRUST_PROXY"];
    else process.env["TRUST_PROXY"] = trustProxy;
    vi.resetModules();
    // o import() de um módulo CommonJS é tipado com o "default" duplo; em tempo de execução é o app
    return (await import("../../app.js")).default as unknown as typeof appCarregado;
}

afterEach(() => {
    delete process.env["TRUST_PROXY"];
});

function registrar(app: typeof appCarregado, ip: string) {
    return request(app).post("/api/publico/interesses").set("X-Forwarded-For", ip).send(interesse);
}

describe("trust proxy e limitador de requisições", () => {
    it("com TRUST_PROXY=1 (atrás do Nginx), o limite é por IP real do X-Forwarded-For", async () => {
        const app = await appCom("1");
        prismaMock.solicitacaoAdocao.findFirst.mockResolvedValue(null);
        prismaMock.animal.updateMany.mockResolvedValue({ count: 1 });

        for (let i = 0; i < 5; i++) expect((await registrar(app, "203.0.113.10")).status).toBe(201);
        expect((await registrar(app, "203.0.113.10")).status).toBe(429);
        // outro visitante atrás do mesmo proxy não é bloqueado
        expect((await registrar(app, "198.51.100.20")).status).toBe(201);
        expect(app.get("trust proxy")).toBe(1);
    });

    it("sem TRUST_PROXY, o X-Forwarded-For é ignorado (não dá para fugir do limite trocando o header)", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {}); // aviso do express-rate-limit sobre o header
        const app = await appCom(undefined);
        prismaMock.solicitacaoAdocao.findFirst.mockResolvedValue(null);
        prismaMock.animal.updateMany.mockResolvedValue({ count: 1 });

        for (let i = 0; i < 5; i++) expect((await registrar(app, `203.0.113.${i}`)).status).toBe(201);
        expect((await registrar(app, "198.51.100.99")).status).toBe(429);
        expect(app.get("trust proxy")).toBe(false);
    });
});
