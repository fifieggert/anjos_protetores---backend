import { describe, expect, it } from "vitest";
import { atualizarUsuarioSchema, criarUsuarioSchema, trocarSenhaSchema } from "../../validators/usuarioValidator";
import { errosDe } from "../helpers/zod";

const valido = {
    nome: "Maria Silva",
    cpf: "529.982.247-25",
    email: "  Maria@Exemplo.COM ",
    senha: "senha-forte",
    perfil: "VOLUNTARIO",
};

describe("criarUsuarioSchema", () => {
    it("aceita CPF com pontuação e guarda só os 11 dígitos", () => {
        expect(criarUsuarioSchema.parse(valido).cpf).toBe("52998224725");
    });

    it("normaliza o e-mail (sem espaços e em minúsculas)", () => {
        expect(criarUsuarioSchema.parse(valido).email).toBe("maria@exemplo.com");
    });

    it.each([
        ["dígito verificador errado", "529.982.247-26"],
        ["primeiro dígito verificador errado", "529.982.247-15"],
        ["todos os dígitos iguais", "111.111.111-11"],
        ["menos de 11 dígitos", "5299822472"],
        ["mais de 11 dígitos", "529982247250"],
        ["nenhum dígito", "abc.def.ghi-jk"],
    ])("recusa CPF com %s", (_caso, cpf) => {
        expect(errosDe(criarUsuarioSchema, { ...valido, cpf })).toEqual({ cpf: "CPF inválido." });
    });

    it("aceita CPF cujo dígito verificador calculado é 0 (resto 10)", () => {
        // 123.456.789-09: o primeiro dígito tem resto 10 e vira 0
        expect(criarUsuarioSchema.safeParse({ ...valido, cpf: "123.456.789-09" }).success).toBe(true);
    });

    it("recusa senha com menos de 8 caracteres", () => {
        expect(errosDe(criarUsuarioSchema, { ...valido, senha: "1234567" }).senha).toBe("Deve ter no mínimo 8 caracteres.");
    });

    it("recusa senha com mais de 72 bytes mesmo com poucos caracteres (acentos)", () => {
        const senha = "é".repeat(37); // 37 caracteres, 74 bytes
        expect(errosDe(criarUsuarioSchema, { ...valido, senha }).senha).toMatch(/72 bytes/);
    });

    it("aceita senha de exatamente 72 bytes e não apara espaços", () => {
        const senha = ` ${"a".repeat(70)} `;
        expect(criarUsuarioSchema.parse({ ...valido, senha }).senha).toBe(senha);
    });

    it("recusa o perfil antigo FUNCIONARIO com mensagem própria", () => {
        expect(errosDe(criarUsuarioSchema, { ...valido, perfil: "FUNCIONARIO" }).perfil).toBe(
            "Perfil inválido. Perfis válidos: ADMIN, VOLUNTARIO.",
        );
    });

    it("exige o perfil", () => {
        const { perfil: _perfil, ...semPerfil } = valido;
        expect(errosDe(criarUsuarioSchema, semPerfil).perfil).toBeDefined();
    });

    it("recusa campo extra como senhaHash (strictObject)", () => {
        expect(errosDe(criarUsuarioSchema, { ...valido, senhaHash: "$2b$10$xxx" })).toEqual({
            senhaHash: "Campo não permitido.",
        });
    });

    it("recusa e-mail inválido", () => {
        expect(errosDe(criarUsuarioSchema, { ...valido, email: "maria@" }).email).toBe("E-mail inválido.");
    });
});

describe("atualizarUsuarioSchema", () => {
    it("aceita só um campo", () => {
        expect(atualizarUsuarioSchema.parse({ ativo: false })).toEqual({ ativo: false });
    });

    it("recusa corpo vazio", () => {
        expect(errosDe(atualizarUsuarioSchema, {})).toEqual({ corpo: "Informe ao menos um campo para atualizar." });
    });

    it("continua recusando campos desconhecidos", () => {
        expect(errosDe(atualizarUsuarioSchema, { senhaHash: "x" })).toHaveProperty("senhaHash");
    });
});

describe("trocarSenhaSchema", () => {
    it("aceita nova senha diferente da atual", () => {
        expect(trocarSenhaSchema.safeParse({ senhaAtual: "antiga-123", novaSenha: "nova-senha-1" }).success).toBe(true);
    });

    it("recusa nova senha igual à atual", () => {
        expect(errosDe(trocarSenhaSchema, { senhaAtual: "mesma-senha", novaSenha: "mesma-senha" })).toEqual({
            novaSenha: "A nova senha deve ser diferente da atual.",
        });
    });

    it("exige a senha atual e aplica a regra de força só na nova", () => {
        expect(errosDe(trocarSenhaSchema, { senhaAtual: "", novaSenha: "curta" })).toEqual({
            senhaAtual: "Informe a senha atual.",
            novaSenha: "Deve ter no mínimo 8 caracteres.",
        });
        // senha atual fraca (de antes da regra) continua aceita
        expect(trocarSenhaSchema.safeParse({ senhaAtual: "123", novaSenha: "nova-senha-1" }).success).toBe(true);
    });

    it("recusa o campo id no corpo (o usuário vem do token)", () => {
        expect(errosDe(trocarSenhaSchema, { senhaAtual: "a", novaSenha: "nova-senha-1", id: "x" })).toHaveProperty("id");
    });
});
