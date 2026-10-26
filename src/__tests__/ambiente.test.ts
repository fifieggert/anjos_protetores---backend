import { describe, expect, it } from "vitest";
import prisma from "../config/prisma";
import { JWT_SECRET } from "../config/env";
import { prismaMock } from "./helpers/prisma";

// Garante que os testes rodam isolados: variáveis falsas do vitest.config e Prisma mockado.
describe("ambiente de teste", () => {
    it("usa as variáveis falsas do vitest.config (o .env não é carregado)", () => {
        expect(JWT_SECRET).toBe("segredo-falso-somente-para-testes");
        expect(process.env["DATABASE_URL"]).toContain("banco-inexistente.invalid");
    });

    it("o cliente Prisma da aplicação é o mock, sem conexão com o MySQL", () => {
        expect(prisma).toBe(prismaMock);
    });
});
