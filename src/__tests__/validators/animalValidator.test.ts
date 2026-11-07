import { describe, expect, it } from "vitest";
import { atualizarAnimalSchema, criarAnimalSchema } from "../../validators/animalValidator";
import { errosDe } from "../helpers/zod";

const valido = { nome: " Rex ", especie: "CACHORRO", porte: "MEDIO" };

describe("criarAnimalSchema", () => {
    it("aceita o mínimo e apara o nome", () => {
        expect(criarAnimalSchema.parse(valido)).toEqual({ nome: "Rex", especie: "CACHORRO", porte: "MEDIO" });
    });

    it.each(["DISPONIVEL", "EM_TRATAMENTO"])("aceita status inicial %s", (status) => {
        expect(criarAnimalSchema.safeParse({ ...valido, status }).success).toBe(true);
    });

    it.each(["EM_ESPERA", "ADOTADO"])("não aceita cadastrar já com status %s (só o fluxo de adoção define)", (status) => {
        expect(errosDe(criarAnimalSchema, { ...valido, status })).toHaveProperty("status");
    });

    it("recusa usuarioCadastroId no corpo (quem cadastrou vem do token)", () => {
        expect(errosDe(criarAnimalSchema, { ...valido, usuarioCadastroId: "x" })).toEqual({
            usuarioCadastroId: "Campo não permitido.",
        });
    });

    it("recusa data de castração sem o animal ser castrado (padrão false)", () => {
        expect(errosDe(criarAnimalSchema, { ...valido, dataCastracao: "2026-01-10" })).toEqual({
            dataCastracao: "Deixe vazio quando o animal não é castrado.",
        });
    });

    it("aceita data de castração quando castrado", () => {
        const dados = criarAnimalSchema.parse({ ...valido, castrado: true, dataCastracao: "2026-01-10" });
        expect(dados.dataCastracao).toEqual(new Date("2026-01-10T00:00:00.000Z"));
    });

    it("recusa doses e revacinação quando não vacinado", () => {
        expect(
            errosDe(criarAnimalSchema, { ...valido, vacinado: false, dosesVacina: 2, dataRevacinacao: "2027-01-01" }),
        ).toEqual({
            dosesVacina: "Deixe vazio quando o animal não é vacinado.",
            dataRevacinacao: "Deixe vazio quando o animal não é vacinado.",
        });
    });

    it("recusa fotoUrl que não seja http/https", () => {
        expect(errosDe(criarAnimalSchema, { ...valido, fotoUrl: "ftp://exemplo.com/a.png" })).toHaveProperty("fotoUrl");
        expect(criarAnimalSchema.safeParse({ ...valido, fotoUrl: "https://exemplo.com/a.png" }).success).toBe(true);
    });

    it("aceita em fotoUrl o caminho devolvido pelo upload de imagens", () => {
        for (const ext of ["jpg", "png", "webp"]) {
            const fotoUrl = `/api/imagens/0f8b2c3d-1e2f-4a5b-8c6d-7e8f9a0b1c2d.${ext}`;
            expect(criarAnimalSchema.parse({ ...valido, fotoUrl }).fotoUrl).toBe(fotoUrl);
        }
        expect(criarAnimalSchema.parse({ ...valido, fotoUrl: null }).fotoUrl).toBeNull();
    });

    it.each([
        "/api/imagens/0f8b2c3d-1e2f-4a5b-8c6d-7e8f9a0b1c2d.gif",
        "/api/imagens/0F8B2C3D-1E2F-4A5B-8C6D-7E8F9A0B1C2D.jpg",
        "/api/imagens/../../etc/passwd",
        "/api/imagens/0f8b2c3d-1e2f-4a5b-8c6d-7e8f9a0b1c2d.jpg?x=1",
        "/outra/0f8b2c3d-1e2f-4a5b-8c6d-7e8f9a0b1c2d.jpg",
        "api/imagens/0f8b2c3d-1e2f-4a5b-8c6d-7e8f9a0b1c2d.jpg",
        "javascript:alert(1)",
        "",
    ])("recusa fotoUrl fora dos formatos aceitos: %s", (fotoUrl) => {
        expect(errosDe(criarAnimalSchema, { ...valido, fotoUrl })).toEqual({
            fotoUrl: "URL inválida. Use um endereço http(s) ou o caminho devolvido pelo envio de imagem (/api/imagens/...).",
        });
    });

    it("mantém o limite de 191 caracteres na fotoUrl", () => {
        const longa = `https://exemplo.com/${"a".repeat(172)}`;
        expect(longa).toHaveLength(192);
        expect(errosDe(criarAnimalSchema, { ...valido, fotoUrl: longa })).toEqual({
            fotoUrl: "Deve ter no máximo 191 caracteres.",
        });
        expect(criarAnimalSchema.safeParse({ ...valido, fotoUrl: longa.slice(0, 191) }).success).toBe(true);
    });

    it("transforma descrição vazia em null", () => {
        expect(criarAnimalSchema.parse({ ...valido, descricao: "   " }).descricao).toBeNull();
    });

    it("mostra mensagens em português para tipo, limite e enum", () => {
        expect(errosDe(criarAnimalSchema, { ...valido, nome: 10, idade: 41, porte: "ENORME" })).toEqual({
            nome: "Deve ser um texto.",
            idade: "Deve ser menor ou igual a 40.",
            porte: "Valor inválido. Use: PEQUENO, MEDIO, GRANDE.",
        });
        expect(errosDe(criarAnimalSchema, { ...valido, idade: -1, nome: "" })).toEqual({
            idade: "Deve ser maior ou igual a 0.",
            nome: "Não pode ficar vazio.",
        });
        expect(errosDe(criarAnimalSchema, { ...valido, nome: null, castrado: "sim" })).toEqual({
            nome: "Não pode ser nulo.",
            castrado: "Deve ser verdadeiro ou falso.",
        });
        expect(errosDe(criarAnimalSchema, { especie: "GATO", porte: "MEDIO" })).toEqual({ nome: "Campo obrigatório." });
        expect(errosDe(criarAnimalSchema, { ...valido, raca: "x".repeat(192) })).toEqual({
            raca: "Deve ter no máximo 191 caracteres.",
        });
    });

    it("recusa data em formato brasileiro", () => {
        expect(errosDe(criarAnimalSchema, { ...valido, castrado: true, dataCastracao: "10/01/2026" })).toEqual({
            dataCastracao: "Data inválida. Use o formato AAAA-MM-DD ou AAAA-MM-DDTHH:MM:SSZ.",
        });
    });
});

describe("atualizarAnimalSchema", () => {
    it("aceita qualquer status do enum (as regras ficam no animalService)", () => {
        expect(atualizarAnimalSchema.safeParse({ status: "ADOTADO" }).success).toBe(true);
    });

    it("recusa corpo vazio", () => {
        expect(errosDe(atualizarAnimalSchema, {})).toEqual({ corpo: "Informe ao menos um campo para atualizar." });
    });

    it("confere castração dentro do próprio corpo", () => {
        expect(errosDe(atualizarAnimalSchema, { castrado: false, dataCastracao: "2026-01-10" })).toHaveProperty(
            "dataCastracao",
        );
        // sem "castrado" no corpo, quem confere é o service (com o valor gravado)
        expect(atualizarAnimalSchema.safeParse({ dataCastracao: "2026-01-10" }).success).toBe(true);
    });

    it("permite limpar campos opcionais com null", () => {
        expect(atualizarAnimalSchema.parse({ raca: null, dataCastracao: null })).toEqual({
            raca: null,
            dataCastracao: null,
        });
    });
});
