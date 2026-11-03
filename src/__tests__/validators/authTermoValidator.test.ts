import { describe, expect, it } from "vitest";
import { loginSchema } from "../../validators/authValidator";
import { atualizarTermoAdocaoSchema, criarTermoAdocaoSchema } from "../../validators/termoAdocaoValidator";
import { errosDe } from "../helpers/zod";

describe("loginSchema", () => {
    it("normaliza o e-mail e mantém a senha exatamente como digitada", () => {
        expect(loginSchema.parse({ email: "  Admin@Abrigo.ORG ", senha: " com espaço " })).toEqual({
            email: "admin@abrigo.org",
            senha: " com espaço ",
        });
    });

    it("mensagens próprias para campos ausentes ou vazios", () => {
        expect(errosDe(loginSchema, {})).toEqual({ email: "Informe o e-mail.", senha: "Informe a senha." });
        expect(errosDe(loginSchema, { email: "  ", senha: "" })).toEqual({
            email: "Informe o e-mail.",
            senha: "Informe a senha.",
        });
    });

    it("recusa e-mail inválido e senha absurdamente longa", () => {
        expect(errosDe(loginSchema, { email: "x", senha: "a".repeat(201) })).toEqual({
            email: "E-mail inválido.",
            senha: "Deve ter no máximo 200 caracteres.",
        });
    });

    it("tipo errado usa a mensagem padrão", () => {
        expect(errosDe(loginSchema, { email: 1, senha: true })).toEqual({
            email: "Deve ser um texto.",
            senha: "Deve ser um texto.",
        });
    });
});

describe("termoAdocaoValidator", () => {
    it("criação exige animalId e aceita solicitação opcional", () => {
        expect(errosDe(criarTermoAdocaoSchema, {})).toEqual({ animalId: "Campo obrigatório." });
    });

    it("não aceita data de assinatura em termo não assinado", () => {
        expect(errosDe(atualizarTermoAdocaoSchema, { assinado: false, assinadoEm: "2026-10-20" })).toEqual({
            assinadoEm: "Informe a data de assinatura só quando o termo estiver assinado.",
        });
    });

    it("aceita assinado com data e hora com fuso", () => {
        expect(atualizarTermoAdocaoSchema.parse({ assinado: true, assinadoEm: "2026-10-20T10:00:00-03:00" })).toEqual({
            assinado: true,
            assinadoEm: new Date("2026-10-20T13:00:00.000Z"),
        });
    });
});
