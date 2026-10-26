import { describe, expect, it } from "vitest";
import { atualizarDoacaoSchema, criarDoacaoSchema } from "../../validators/doacaoValidator";
import { atualizarSaidaEstoqueSchema, criarSaidaEstoqueSchema } from "../../validators/saidaEstoqueValidator";
import { atualizarItemEstoqueSchema, criarItemEstoqueSchema } from "../../validators/itemEstoqueValidator";
import { errosDe } from "../helpers/zod";

const ITEM = "55555555-5555-4555-8555-555555555555";

describe("criarDoacaoSchema", () => {
    it.each([
        ["ausente", undefined],
        ["nulo", null],
        ["vazio", "   "],
    ])("doador %s vira Anônimo", (_caso, doador) => {
        expect(criarDoacaoSchema.parse({ itemId: ITEM, quantidade: 3, doador }).doador).toBe("Anônimo");
    });

    it("mantém o doador informado (aparado) e converte a data", () => {
        expect(criarDoacaoSchema.parse({ itemId: ITEM, quantidade: 3, doador: " João ", dataEntrada: "2026-10-01" })).toEqual({
            itemId: ITEM,
            quantidade: 3,
            doador: "João",
            dataEntrada: new Date("2026-10-01T00:00:00.000Z"),
        });
    });

    it.each([0, -1, 1.5])("recusa quantidade %s", (quantidade) => {
        expect(errosDe(criarDoacaoSchema, { itemId: ITEM, quantidade })).toHaveProperty("quantidade");
    });

    it("recusa usuarioId no corpo", () => {
        expect(errosDe(criarDoacaoSchema, { itemId: ITEM, quantidade: 1, usuarioId: ITEM })).toEqual({
            usuarioId: "Campo não permitido.",
        });
    });

    it("na edição não aceita mudar item nem quantidade", () => {
        expect(errosDe(atualizarDoacaoSchema, { quantidade: 10 })).toMatchObject({ quantidade: "Campo não permitido." });
        expect(atualizarDoacaoSchema.parse({ doador: "" })).toEqual({ doador: "Anônimo" });
    });
});

describe("criarSaidaEstoqueSchema", () => {
    it("exige finalidade e quantidade positiva", () => {
        expect(errosDe(criarSaidaEstoqueSchema, { itemId: ITEM, quantidade: 0, finalidade: " " })).toEqual({
            quantidade: "Deve ser maior ou igual a 1.",
            finalidade: "Não pode ficar vazio.",
        });
    });

    it("aceita saída válida", () => {
        expect(
            criarSaidaEstoqueSchema.safeParse({ itemId: ITEM, quantidade: 2, finalidade: "Ração do canil" }).success,
        ).toBe(true);
    });

    it("na edição não aceita mudar a quantidade", () => {
        expect(errosDe(atualizarSaidaEstoqueSchema, { quantidade: 1 })).toMatchObject({ quantidade: "Campo não permitido." });
    });
});

describe("criarItemEstoqueSchema", () => {
    it("usa 0 como padrão para as quantidades", () => {
        expect(criarItemEstoqueSchema.parse({ nomeItem: "Ração", categoria: "RACAO" })).toEqual({
            nomeItem: "Ração",
            categoria: "RACAO",
            quantidadeAtual: 0,
            quantidadeMinima: 0,
        });
    });

    it("recusa quantidade negativa e categoria inválida", () => {
        expect(errosDe(criarItemEstoqueSchema, { nomeItem: "Ração", categoria: "COMIDA", quantidadeMinima: -1 })).toEqual({
            categoria: "Valor inválido. Use: RACAO, MEDICAMENTO, HIGIENE, LIMPEZA, ACESSORIO.",
            quantidadeMinima: "Deve ser maior ou igual a 0.",
        });
    });

    it("na edição não aceita quantidadeAtual (só muda por doação e saída)", () => {
        expect(errosDe(atualizarItemEstoqueSchema, { quantidadeAtual: 10 })).toMatchObject({
            quantidadeAtual: "Campo não permitido.",
        });
    });
});
