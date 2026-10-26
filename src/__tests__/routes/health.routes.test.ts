import { describe, expect, it, vi } from "vitest";
import { prismaMock } from "../helpers/prisma";
import { api } from "../helpers/app";
import { erroPrisma } from "../helpers/erros";

describe("GET /health (liveness)", () => {
    it("responde 200 sem tocar no banco e sem autenticação", async () => {
        const res = await api().get("/health");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok" });
        expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });
});

describe("GET /health/ready (readiness)", () => {
    it("banco respondendo ao SELECT 1: 200", async () => {
        prismaMock.$queryRaw.mockResolvedValue([{ 1: 1 }] as never);

        const res = await api().get("/health/ready");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok" });
        expect(res.headers["cache-control"]).toBe("no-store");
        const [consulta] = prismaMock.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray];
        expect(consulta.join("")).toBe("SELECT 1");
    });

    it.each([
        ["erro do Prisma", erroPrisma("P1001")],
        ["rejeição que não é Error", "falhou"],
        ["erro de conexão do driver", Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:3306 user=anjos"), { code: "ECONNREFUSED" })],
    ])("banco indisponível (%s): 503 sem detalhes do erro", async (_caso, erro) => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        prismaMock.$queryRaw.mockRejectedValue(erro);

        const res = await api().get("/health/ready");

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ status: "indisponivel" });
        expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|P1001|10\.0\.0\.5/);
        // o log registra só o tipo do erro, nunca a mensagem (pode ter host/usuário)
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/10\.0\.0\.5|user=/);
    });

    it("banco que não responde (pool tentando conectar): 503 em 3 s, sem esperar o driver", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
        prismaMock.$queryRaw.mockReturnValue(new Promise(() => {}) as never);

        const resposta = api().get("/health/ready").then((res) => res);
        // espera a requisição chegar ao handler (I/O real) antes de mexer no relógio
        while (prismaMock.$queryRaw.mock.calls.length === 0) await new Promise((r) => setImmediate(r));
        await vi.advanceTimersByTimeAsync(2_999);
        let respondeu = false;
        void resposta.then(() => (respondeu = true));
        await vi.advanceTimersByTimeAsync(0);
        expect(respondeu).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        const res = await resposta;
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ status: "indisponivel" });
    });

    it("não passa pelo limitador nem pela autenticação (muitas chamadas seguidas)", async () => {
        prismaMock.$queryRaw.mockResolvedValue([] as never);
        for (let i = 0; i < 15; i++) {
            expect((await api().get("/health/ready")).status).toBe(200);
        }
    });

    it("fica fora do prefixo /api", async () => {
        expect((await api().get("/api/health")).status).toBe(404);
    });
});
