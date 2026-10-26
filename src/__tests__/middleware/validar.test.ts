import { z } from "zod";
import { describe, expect, it } from "vitest";
import { validar, validarConsulta } from "../../middleware/validar";
import { criarEventoSchema, filtrosEventoSchema } from "../../validators/eventoValidator";
import { atualizarUsuarioSchema } from "../../validators/usuarioValidator";
import { proximo, requisicao, resposta } from "../helpers/express";

const ID = "11111111-1111-4111-8111-111111111111";

describe("validar", () => {
    it("corpo válido é trocado pela versão validada (aparada e convertida)", () => {
        const req = requisicao({ body: { titulo: "  Feira  ", data: "2026-11-14T15:00:00Z", horarioInicio: "09:00", local: "Praça" } });
        const next = proximo();
        validar(criarEventoSchema)(req, resposta(), next);
        expect(next).toHaveBeenCalledOnce();
        expect(req.body).toEqual({ titulo: "Feira", data: "2026-11-14", horarioInicio: "09:00", local: "Praça" });
    });

    it("erro do zod dá 400 com as mensagens por campo", () => {
        const res = resposta();
        const next = proximo();
        validar(criarEventoSchema)(requisicao({ body: { titulo: "ab", extra: 1, outro: 2 } }), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.corpo).toMatchObject({
            error: "Dados inválidos.",
            campos: {
                titulo: "O título deve ter no mínimo 3 caracteres.",
                // data ausente: a union de formatos dá "Data inválida" em vez de "Campo obrigatório"
                data: "Data inválida. Use o formato AAAA-MM-DD ou AAAA-MM-DDTHH:MM:SSZ.",
                extra: "Campo não permitido.",
                outro: "Campo não permitido.",
            },
        });
    });

    it("erro sem caminho (corpo vazio no PUT) usa a chave corpo", () => {
        const res = resposta();
        validar(atualizarUsuarioSchema)(requisicao({ body: {} }), res, proximo());
        expect(res.corpo).toEqual({ error: "Dados inválidos.", campos: { corpo: "Informe ao menos um campo para atualizar." } });
    });

    it("sem corpo (undefined) valida como objeto vazio", () => {
        const res = resposta();
        validar(z.strictObject({ a: z.string() }))(requisicao(), res, proximo());
        expect(res.corpo).toEqual({ error: "Dados inválidos.", campos: { a: "Campo obrigatório." } });
    });

    it("caminho aninhado vira a.b", () => {
        const res = resposta();
        validar(z.object({ a: z.object({ b: z.string() }) }))(requisicao({ body: { a: { b: 1 } } }), res, proximo());
        expect(res.corpo).toEqual({ error: "Dados inválidos.", campos: { "a.b": "Deve ser um texto." } });
    });

    it("valida o :id da rota mesmo sem schema de corpo", () => {
        const res = resposta();
        const next = proximo();
        validar()(requisicao({ params: { id: "123" } }), res, next);
        expect(res.statusCode).toBe(400);
        expect(res.corpo).toEqual({ error: "Dados inválidos.", campos: { id: "Identificador inválido." } });
        expect(next).not.toHaveBeenCalled();
    });

    it("id válido e sem schema segue adiante", () => {
        const next = proximo();
        validar()(requisicao({ params: { id: ID } }), resposta(), next);
        expect(next).toHaveBeenCalledOnce();
    });

    it("junta erros do id e do corpo", () => {
        const res = resposta();
        validar(atualizarUsuarioSchema)(requisicao({ params: { id: "x" }, body: { perfil: "FUNCIONARIO" } }), res, proximo());
        expect(Object.keys((res.corpo as { campos: object }).campos)).toEqual(["id", "perfil"]);
    });
});

describe("validarConsulta", () => {
    it("guarda a consulta validada em res.locals.consulta", () => {
        const res = resposta();
        const next = proximo();
        validarConsulta(filtrosEventoSchema)(requisicao({ query: {} }), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.locals["consulta"]).toEqual({ periodo: "todos" });
    });

    it("consulta inválida dá 400", () => {
        const res = resposta();
        validarConsulta(filtrosEventoSchema)(requisicao({ query: { periodo: "x", y: "1" } }), res, proximo());
        expect(res.statusCode).toBe(400);
        expect(res.corpo).toMatchObject({ error: "Dados inválidos.", campos: { y: "Campo não permitido." } });
    });
});
