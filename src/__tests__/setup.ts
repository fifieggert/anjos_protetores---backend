import { afterEach, beforeEach, vi } from "vitest";
import { mockReset } from "vitest-mock-extended";
import { prismaMock } from "./helpers/prisma";
import { AGORA } from "./helpers/tempo";
import { ArmazenamentoMemoria } from "./helpers/armazenamento";
import { definirArmazenamento } from "../storage";

vi.mock("../config/prisma", async () => ({ default: (await import("./helpers/prisma.js")).prismaMock }));
// log de requisições do morgan desligado para não poluir a saída dos testes
vi.mock("morgan", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));

// Instante fixo para tudo que usa a data atual (hoje(), JWT, "gerado em"...). Só o Date é
// falso: os timers continuam reais para o supertest e o bcrypt funcionarem.
beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AGORA);

    // upload de imagens sempre em memória (nunca na pasta ./uploads nem no S3)
    definirArmazenamento(new ArmazenamentoMemoria());

    mockReset(prismaMock);
    // a transação executa a função com o próprio mock como "tx"
    prismaMock.$transaction.mockImplementation(((operacao: (tx: typeof prismaMock) => unknown) =>
        operacao(prismaMock)) as never);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
