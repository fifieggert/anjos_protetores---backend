import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { authMiddleware, permitirPerfis, somenteAdmin, usuarioLogado } from "../../middleware/authMiddleware";
import { AppError } from "../../utils/AppError";
import { ID_ADMIN, token } from "../helpers/auth";
import { proximo, requisicao, resposta } from "../helpers/express";

const SEGREDO = process.env["JWT_SECRET"] as string;

function autenticar(authorization?: string) {
    const req = requisicao(authorization === undefined ? {} : { headers: { authorization } });
    const res = resposta();
    const next = proximo();
    authMiddleware(req, res, next);
    return { req, res, next };
}

describe("authMiddleware", () => {
    it("sem o header Authorization dá 401", () => {
        const { res, next } = autenticar();
        expect(res.statusCode).toBe(401);
        expect(res.corpo).toEqual({ error: "Token não informado." });
        expect(next).not.toHaveBeenCalled();
    });

    it.each(["Basic abc", "Bearer", "bearer abc", "abc"])("header mal formatado (%s) dá 401", (header) => {
        const { res, next } = autenticar(header);
        expect(res.statusCode).toBe(401);
        expect(res.corpo).toEqual({ error: "Token mal formatado." });
        expect(next).not.toHaveBeenCalled();
    });

    it("token assinado com outro segredo dá 401", () => {
        const falso = jwt.sign({ id: ID_ADMIN, perfil: "ADMIN" }, "outro-segredo");
        const { res, next } = autenticar(`Bearer ${falso}`);
        expect(res.statusCode).toBe(401);
        expect(res.corpo).toEqual({ error: "Token inválido ou expirado." });
        expect(next).not.toHaveBeenCalled();
    });

    it("token expirado dá 401", () => {
        const valido = token("ADMIN"); // expira em 30 min
        vi.setSystemTime(new Date(Date.now() + 31 * 60 * 1000));
        const { res, next } = autenticar(`Bearer ${valido}`);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("token ainda dentro da validade passa", () => {
        const valido = token("ADMIN");
        vi.setSystemTime(new Date(Date.now() + 29 * 60 * 1000));
        expect(autenticar(`Bearer ${valido}`).next).toHaveBeenCalled();
    });

    it("só aceita HS256 (recusa outro algoritmo, mesmo com o segredo certo)", () => {
        const hs512 = jwt.sign({ id: ID_ADMIN, perfil: "ADMIN" }, SEGREDO, { algorithm: "HS512" });
        expect(autenticar(`Bearer ${hs512}`).res.statusCode).toBe(401);
    });

    it("recusa token sem assinatura (alg none)", () => {
        const semAssinatura = jwt.sign({ id: ID_ADMIN, perfil: "ADMIN" }, "", { algorithm: "none" });
        expect(autenticar(`Bearer ${semAssinatura}`).res.statusCode).toBe(401);
    });

    it.each([
        ["sem perfil", { id: ID_ADMIN }],
        ["perfil antigo FUNCIONARIO", { id: ID_ADMIN, perfil: "FUNCIONARIO" }],
        ["id que não é texto", { id: 1, perfil: "ADMIN" }],
    ])("payload inválido (%s) dá 401", (_caso, payload) => {
        const { res, next } = autenticar(`Bearer ${jwt.sign(payload, SEGREDO)}`);
        expect(res.statusCode).toBe(401);
        expect(res.corpo).toEqual({ error: "Token inválido ou expirado." });
        expect(next).not.toHaveBeenCalled();
    });

    it("payload em texto (não objeto) dá 401", () => {
        expect(autenticar(`Bearer ${jwt.sign("texto", SEGREDO)}`).res.statusCode).toBe(401);
    });

    it("token válido preenche req.usuario só com id e perfil", () => {
        const comExtra = jwt.sign({ id: ID_ADMIN, perfil: "ADMIN", nome: "x", admin: true }, SEGREDO);
        const { req, next } = autenticar(`Bearer ${comExtra}`);
        expect(next).toHaveBeenCalledOnce();
        expect(req.usuario).toEqual({ id: ID_ADMIN, perfil: "ADMIN" });
    });
});

describe("permitirPerfis / somenteAdmin", () => {
    it("sem usuário autenticado dá 401", () => {
        const res = resposta();
        const next = proximo();
        somenteAdmin(requisicao(), res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("VOLUNTARIO em rota de ADMIN dá 403", () => {
        const res = resposta();
        const next = proximo();
        somenteAdmin(requisicao({ usuario: { id: "v", perfil: "VOLUNTARIO" } }), res, next);
        expect(res.statusCode).toBe(403);
        expect(res.corpo).toEqual({ error: "Você não tem permissão para acessar este recurso." });
        expect(next).not.toHaveBeenCalled();
    });

    it("ADMIN passa", () => {
        const next = proximo();
        somenteAdmin(requisicao({ usuario: { id: "a", perfil: "ADMIN" } }), resposta(), next);
        expect(next).toHaveBeenCalledOnce();
    });

    it("com vários perfis permitidos, VOLUNTARIO também passa", () => {
        const next = proximo();
        permitirPerfis("ADMIN", "VOLUNTARIO")(requisicao({ usuario: { id: "v", perfil: "VOLUNTARIO" } }), resposta(), next);
        expect(next).toHaveBeenCalledOnce();
    });
});

describe("usuarioLogado", () => {
    it("devolve o usuário do token", () => {
        expect(usuarioLogado(requisicao({ usuario: { id: "a", perfil: "ADMIN" } }))).toEqual({ id: "a", perfil: "ADMIN" });
    });

    it("sem usuário lança AppError 401", () => {
        expect(() => usuarioLogado(requisicao())).toThrow(AppError);
    });
});
