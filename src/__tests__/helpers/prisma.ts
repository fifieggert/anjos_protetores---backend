import type { PrismaClient } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";

// Cliente Prisma falso usado no lugar de src/config/prisma (ver setup.ts). Nenhum teste
// conecta ao MySQL: cada teste define o que cada consulta devolve.
export const prismaMock = mockDeep<PrismaClient>();
