import bcrypt from "bcrypt";
import { describe, expect, it, vi } from "vitest";
import { diaDoBanco, diaNoFuso, diaParaBanco, hoje } from "../../utils/datas";
import { compararSenha, gerarHashSenha } from "../../utils/senha";
import { AppError } from "../../utils/AppError";

describe("datas", () => {
    it("diaNoFuso usa o dia de Brasília, não o UTC nem o fuso da máquina", () => {
        // 02:59 UTC = 23:59 do dia anterior em Brasília (os testes rodam com TZ=Asia/Tokyo)
        expect(diaNoFuso(new Date("2026-10-22T02:59:00Z"))).toBe("2026-10-21");
        expect(diaNoFuso(new Date("2026-10-22T03:00:00Z"))).toBe("2026-10-22");
    });

    it("o meio-dia local enviado pelo frontend continua no mesmo dia", () => {
        expect(diaNoFuso(new Date("2026-10-21T15:00:00.000Z"))).toBe("2026-10-21");
    });

    it("hoje() segue o relógio (falso) no fuso do abrigo", () => {
        expect(hoje()).toBe("2026-10-25");
        vi.setSystemTime(new Date("2026-10-26T02:00:00Z")); // ainda 25/10, 23h em Brasília
        expect(hoje()).toBe("2026-10-25");
        vi.setSystemTime(new Date("2026-10-26T03:00:00Z"));
        expect(hoje()).toBe("2026-10-26");
    });

    it("diaParaBanco grava meia-noite UTC e diaDoBanco devolve o mesmo dia (ida e volta)", () => {
        const data = diaParaBanco("2026-02-28");
        expect(data.toISOString()).toBe("2026-02-28T00:00:00.000Z");
        expect(diaDoBanco(data)).toBe("2026-02-28");
    });

    it("diaDoBanco não recua o dia mesmo com fuso negativo", () => {
        expect(diaDoBanco(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
    });
});

describe("senha", () => {
    it("gera hash bcrypt que confere só com a senha certa", async () => {
        const hash = await gerarHashSenha("minha senha");
        expect(hash).toMatch(/^\$2[aby]\$10\$/);
        expect(hash).not.toContain("minha senha");
        await expect(compararSenha("minha senha", hash)).resolves.toBe(true);
        await expect(compararSenha("outra senha", hash)).resolves.toBe(false);
    });

    it("compara com hash de outro custo", async () => {
        const hash = await bcrypt.hash("abc", 4);
        await expect(compararSenha("abc", hash)).resolves.toBe(true);
    });
});

describe("AppError", () => {
    it("guarda status, mensagem e campos", () => {
        const erro = new AppError(409, "Conflito", { campo: "x" });
        expect(erro).toBeInstanceOf(Error);
        expect(erro).toMatchObject({ name: "AppError", status: 409, message: "Conflito", campos: { campo: "x" } });
    });
});
