import type { PrismaClient } from "@prisma/client";
import type { Mock } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { DeepMockProxy } from "vitest-mock-extended";

// Cliente Prisma falso usado no lugar de src/config/prisma (ver setup.ts). Nenhum teste
// conecta ao MySQL: cada teste define o que cada consulta devolve. Fica em globalThis
// para continuar o mesmo objeto quando um teste recarrega o app com vi.resetModules().
const global = globalThis as { prismaMockCompartilhado?: DeepMockProxy<PrismaClient> };
export const prismaMock = (global.prismaMockCompartilhado ??= mockDeep<PrismaClient>());

// O tipo do groupBy do Prisma é genérico demais para o mock tipado (os métodos de mock
// somem do tipo). Em tempo de execução ele é um vi.fn() normal: aqui só recuperamos o tipo.
export function mockGroupBy(metodo: unknown) {
    return metodo as Mock<(args: { by: string[] }) => Promise<unknown[]>>;
}
