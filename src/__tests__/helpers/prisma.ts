import type { PrismaClient } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";
import type { DeepMockProxy } from "vitest-mock-extended";

// Cliente Prisma falso usado no lugar de src/config/prisma (ver setup.ts). Nenhum teste
// conecta ao MySQL: cada teste define o que cada consulta devolve. Fica em globalThis
// para continuar o mesmo objeto quando um teste recarrega o app com vi.resetModules().
const global = globalThis as { prismaMockCompartilhado?: DeepMockProxy<PrismaClient> };
export const prismaMock = (global.prismaMockCompartilhado ??= mockDeep<PrismaClient>());
