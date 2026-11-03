import { describe, expect, it } from "vitest";
import { mesAtual, ultimosMeses } from "../../utils/meses";
import { AGORA } from "../helpers/tempo";

// Os testes rodam com TZ=Asia/Tokyo (vitest.config): se o helper usasse o fuso da máquina,
// estes resultados sairiam errados.
describe("ultimosMeses (fuso de Brasília, UTC-3)", () => {
    it("6 meses até o atual, do mais antigo ao mais novo", () => {
        expect(ultimosMeses(AGORA, 6).map((m) => m.mes)).toEqual([
            "2026-05",
            "2026-06",
            "2026-07",
            "2026-08",
            "2026-09",
            "2026-10",
        ]);
    });

    it("cada mês vai da meia-noite do dia 1 em Brasília (03:00 UTC) até o início do seguinte", () => {
        const [outubro] = ultimosMeses(AGORA, 1);
        expect(outubro).toEqual({
            mes: "2026-10",
            inicio: new Date("2026-10-01T03:00:00.000Z"),
            fim: new Date("2026-11-01T03:00:00.000Z"),
        });
    });

    it("os meses são contínuos: o fim de um é o início do próximo", () => {
        const meses = ultimosMeses(AGORA, 6);
        for (let i = 1; i < meses.length; i++) {
            expect(meses[i]?.inicio).toEqual(meses[i - 1]?.fim);
        }
    });

    it.each([
        // 23:59:59 do dia 31/10 em Brasília ainda é outubro, embora em UTC já seja 01/11
        ["2026-11-01T02:59:59.999Z", "2026-10"],
        ["2026-11-01T03:00:00.000Z", "2026-11"],
        // 30/11 às 22h em Brasília: em Tóquio (fuso da máquina dos testes) já é 01/12
        ["2026-12-01T01:00:00.000Z", "2026-11"],
    ])("fronteira de mês: %s em Brasília é %s", (instante, esperado) => {
        expect(mesAtual(new Date(instante)).mes).toBe(esperado);
    });

    it("virada de ano: 31/12 às 23h em Brasília ainda é dezembro, e os 6 meses atravessam o ano certo", () => {
        const virada = new Date("2026-01-01T02:00:00.000Z");
        expect(mesAtual(virada)).toEqual({
            mes: "2025-12",
            inicio: new Date("2025-12-01T03:00:00.000Z"),
            fim: new Date("2026-01-01T03:00:00.000Z"),
        });
        expect(ultimosMeses(new Date("2026-02-10T12:00:00.000Z"), 6).map((m) => m.mes)).toEqual([
            "2025-09",
            "2025-10",
            "2025-11",
            "2025-12",
            "2026-01",
            "2026-02",
        ]);
    });
});
