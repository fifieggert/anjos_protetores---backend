import { describe, expect, it } from "vitest";
import {
    MENSAGEM_HORARIO_FIM,
    atualizarEventoSchema,
    criarEventoSchema,
    filtrosEventoSchema,
    fimDepoisDoInicio,
} from "../../validators/eventoValidator";
import { errosDe } from "../helpers/zod";

const valido = { titulo: "Feira de adoção", data: "2026-11-14", horarioInicio: "09:00", local: "Praça" };

describe("criarEventoSchema", () => {
    it("aceita o mínimo", () => {
        expect(criarEventoSchema.parse(valido)).toEqual(valido);
    });

    it("exige título com no mínimo 3 caracteres (depois do trim)", () => {
        expect(errosDe(criarEventoSchema, { ...valido, titulo: "  ab  " })).toEqual({
            titulo: "O título deve ter no mínimo 3 caracteres.",
        });
    });

    it("exige local com no mínimo 2 caracteres", () => {
        expect(errosDe(criarEventoSchema, { ...valido, local: "a" })).toEqual({
            local: "O local deve ter no mínimo 2 caracteres.",
        });
    });

    it.each([
        ["igual ao início", "09:00"],
        ["antes do início", "08:59"],
    ])("recusa horário de fim %s", (_caso, horarioFim) => {
        expect(errosDe(criarEventoSchema, { ...valido, horarioFim })).toEqual({ horarioFim: MENSAGEM_HORARIO_FIM });
    });

    it("aceita horário de fim depois do início ou nulo", () => {
        expect(criarEventoSchema.safeParse({ ...valido, horarioFim: "09:01" }).success).toBe(true);
        expect(criarEventoSchema.safeParse({ ...valido, horarioFim: null }).success).toBe(true);
    });

    it.each(["24:00", "9:00", "09:60", "nove"])("recusa horário inválido %s", (horarioInicio) => {
        expect(errosDe(criarEventoSchema, { ...valido, horarioInicio })).toEqual({
            horarioInicio: "Horário inválido. Use o formato HH:mm, ex.: 14:30.",
        });
    });

    it("mantém a data AAAA-MM-DD como veio", () => {
        expect(criarEventoSchema.parse(valido).data).toBe("2026-11-14");
    });

    it("com data e hora, usa o dia no fuso do abrigo (meio-dia local não recua de dia)", () => {
        // o frontend envia o dia escolhido ao meio-dia de Brasília
        expect(criarEventoSchema.parse({ ...valido, data: "2026-11-14T15:00:00.000Z" }).data).toBe("2026-11-14");
        // 01:30 UTC ainda é dia 13 em Brasília
        expect(criarEventoSchema.parse({ ...valido, data: "2026-11-14T01:30:00Z" }).data).toBe("2026-11-13");
        expect(criarEventoSchema.parse({ ...valido, data: "2026-11-14T00:30:00-03:00" }).data).toBe("2026-11-14");
    });

    it.each(["14/11/2026", "2026-13-01", "amanhã", "", 20261114])("recusa data inválida %s com a mensagem do formato", (data) => {
        expect(errosDe(criarEventoSchema, { ...valido, data })).toEqual({
            data: "Data inválida. Use o formato AAAA-MM-DD ou AAAA-MM-DDTHH:MM:SSZ.",
        });
    });

    it("data ausente diz que o campo é obrigatório", () => {
        const { data: _data, ...semData } = valido;
        expect(errosDe(criarEventoSchema, semData)).toEqual({ data: "Campo obrigatório." });
    });

    it("descrição vazia vira null e criadoPorId não é aceito", () => {
        expect(criarEventoSchema.parse({ ...valido, descricao: " " }).descricao).toBeNull();
        expect(errosDe(criarEventoSchema, { ...valido, criadoPorId: "x" })).toEqual({
            criadoPorId: "Campo não permitido.",
        });
    });
});

describe("atualizarEventoSchema", () => {
    it("aceita só o horário de fim (conferido no service com o gravado)", () => {
        expect(atualizarEventoSchema.parse({ horarioFim: "07:00" })).toEqual({ horarioFim: "07:00" });
    });

    it("recusa corpo vazio", () => {
        expect(errosDe(atualizarEventoSchema, {})).toHaveProperty("corpo");
    });
});

describe("filtrosEventoSchema e fimDepoisDoInicio", () => {
    it("período padrão é todos e valores desconhecidos são recusados", () => {
        expect(filtrosEventoSchema.parse({})).toEqual({ periodo: "todos" });
        expect(errosDe(filtrosEventoSchema, { periodo: "ontem" })).toHaveProperty("periodo");
    });

    it("compara HH:mm como horário", () => {
        expect(fimDepoisDoInicio("09:00", null)).toBe(true);
        expect(fimDepoisDoInicio("09:00", undefined)).toBe(true);
        expect(fimDepoisDoInicio("09:00", "10:00")).toBe(true);
        expect(fimDepoisDoInicio("10:00", "09:59")).toBe(false);
    });
});
