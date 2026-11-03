import { afterEach, beforeEach, vi } from "vitest";
import { mockReset } from "vitest-mock-extended";
import { prismaMock } from "./helpers/prisma";
import { AGORA } from "./helpers/tempo";

vi.mock("../config/prisma", async () => ({ default: (await import("./helpers/prisma.js")).prismaMock }));
// log de requisições do morgan desligado para não poluir a saída dos testes
vi.mock("morgan", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));

// Instante fixo para tudo que usa a data atual (hoje(), JWT, "gerado em"...). Só o Date é
// falso: os timers continuam reais para o supertest e o bcrypt funcionarem.
beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AGORA);

    mockReset(prismaMock);
    // a transação executa a função com o próprio mock como "tx"
    prismaMock.$transaction.mockImplementation(((operacao: (tx: typeof prismaMock) => unknown) =>
        operacao(prismaMock)) as never);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
