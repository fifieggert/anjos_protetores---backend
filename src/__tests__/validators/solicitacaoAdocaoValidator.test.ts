import { describe, expect, it } from "vitest";
import {
    atualizarStatusSolicitacaoSchema,
    filtrosSolicitacaoSchema,
    registrarInteresseSchema,
} from "../../validators/solicitacaoAdocaoValidator";
import { errosDe } from "../helpers/zod";

const ANIMAL = "44444444-4444-4444-8444-444444444444";
const valido = { animalId: ANIMAL, nome: "Ana", telefone: "47999998888", aceitaContato: true };
const MSG_CELULAR = "Informe um celular com DDD, por exemplo (47) 99999-9999.";

const telefone = (valor: string) => registrarInteresseSchema.safeParse({ ...valido, telefone: valor });

describe("registrarInteresseSchema - telefone", () => {
    it.each([
        ["(47) 99999-8888", "47999998888"],
        ["47 9 9999-8888", "47999998888"],
        ["47.99999.8888", "47999998888"],
        ["+55 (47) 99999-8888", "47999998888"],
        ["5547999998888", "47999998888"],
    ])("aceita %s e guarda só os 11 dígitos", (entrada, esperado) => {
        const resultado = telefone(entrada);
        expect(resultado.success && resultado.data.telefone).toBe(esperado);
    });

    it("não remove o 55 de um número com 11 dígitos (55 também é DDD)", () => {
        const resultado = telefone("55999998888");
        expect(resultado.success && resultado.data.telefone).toBe("55999998888");
    });

    it("recusa 55 + número fixo de 10 dígitos (12 dígitos)", () => {
        expect(telefone("554733334444").success).toBe(false);
    });

    it.each([
        ["fixo com 10 dígitos", "4733334444"],
        ["terceiro dígito diferente de 9", "47899998888"],
        ["DDD inexistente (20)", "20999998888"],
        ["DDD inexistente (00)", "00999998888"],
        ["dígitos a menos", "4799999888"],
        ["12 dígitos sem o 55", "479999988881"],
    ])("recusa %s", (_caso, valor) => {
        expect(errosDe(registrarInteresseSchema, { ...valido, telefone: valor })).toEqual({ telefone: MSG_CELULAR });
    });

    it("recusa letras e símbolos com mensagem própria", () => {
        expect(errosDe(registrarInteresseSchema, { ...valido, telefone: "47 9999a-8888" })).toEqual({
            telefone: "Use apenas números, espaços, parênteses, hífen e +55.",
        });
    });

    it("recusa textos longos demais antes de processar", () => {
        expect(errosDe(registrarInteresseSchema, { ...valido, telefone: "9".repeat(31) })).toHaveProperty("telefone");
    });
});

describe("registrarInteresseSchema - demais campos", () => {
    it("exige aceitaContato", () => {
        const { aceitaContato: _aceita, ...semAceite } = valido;
        expect(errosDe(registrarInteresseSchema, semAceite)).toEqual({ aceitaContato: "Campo obrigatório." });
    });

    it("recusa aceitaContato false", () => {
        expect(errosDe(registrarInteresseSchema, { ...valido, aceitaContato: false })).toEqual({
            aceitaContato: "É preciso autorizar o contato do abrigo para registrar o interesse.",
        });
    });

    it("normaliza espaços do nome e exige de 2 a 100 caracteres", () => {
        expect(registrarInteresseSchema.parse({ ...valido, nome: "  Ana   Maria  " }).nome).toBe("Ana Maria");
        expect(errosDe(registrarInteresseSchema, { ...valido, nome: " A " })).toHaveProperty("nome");
        expect(errosDe(registrarInteresseSchema, { ...valido, nome: "a".repeat(101) })).toHaveProperty("nome");
    });

    it("recusa status vindo do cliente e animalId inválido", () => {
        expect(errosDe(registrarInteresseSchema, { ...valido, status: "APROVADA" })).toEqual({
            status: "Campo não permitido.",
        });
        expect(errosDe(registrarInteresseSchema, { ...valido, animalId: "123" })).toEqual({
            animalId: "Identificador inválido.",
        });
    });
});

describe("atualizarStatusSolicitacaoSchema e filtros", () => {
    it("só aceita EM_CONTATO", () => {
        expect(atualizarStatusSolicitacaoSchema.safeParse({ status: "EM_CONTATO" }).success).toBe(true);
        expect(errosDe(atualizarStatusSolicitacaoSchema, { status: "APROVADA" })).toEqual({
            status: "Use EM_CONTATO. Para concluir ou cancelar, use as rotas /concluir e /cancelar.",
        });
        expect(errosDe(atualizarStatusSolicitacaoSchema, {})).toEqual({ status: "Campo obrigatório." });
    });

    it("filtros opcionais validados", () => {
        expect(filtrosSolicitacaoSchema.parse({})).toEqual({});
        expect(errosDe(filtrosSolicitacaoSchema, { status: "X" })).toHaveProperty("status");
    });
});
