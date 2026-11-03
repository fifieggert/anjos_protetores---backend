import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

export default defineConfig({
    resolve: {
        // Os testes nunca leem o .env: "dotenv/config" vira um módulo vazio.
        alias: { "dotenv/config": caminho("./src/__tests__/helpers/semDotenv.ts") },
    },
    test: {
        environment: "node",
        include: ["src/__tests__/**/*.test.ts"],
        setupFiles: ["./src/__tests__/setup.ts"],
        // Valores falsos: o DATABASE_URL nunca é usado (o Prisma é mockado no setup).
        // TZ longe de Brasília para pegar qualquer dependência do fuso da máquina.
        env: {
            NODE_ENV: "test",
            TZ: "Asia/Tokyo",
            JWT_SECRET: "segredo-falso-somente-para-testes",
            DATABASE_URL: "mysql://teste:teste@banco-inexistente.invalid:3306/nao_usar",
            CORS_ORIGIN: "http://localhost:5173",
            ABRIGO_CIDADE: "Blumenau/SC",
            ABRIGO_TELEFONE: "(47) 3333-4444",
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: ["src/**/*.ts"],
            exclude: [
                "src/__tests__/**",
                "src/server.ts",
                "src/config/**",
                "src/scripts/**",
                "src/assets/**",
                "src/**/*.d.ts",
                "generated/**",
            ],
            thresholds: {
                lines: 75,
                statements: 75,
                functions: 75,
                branches: 75,
            },
        },
    },
});
