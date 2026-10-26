import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PerfilUsuario } from "@prisma/client";
import { JWT_SECRET } from "../config/env";
import { AppError } from "../utils/AppError";

export interface TokenPayload {
    id: string;
    perfil: PerfilUsuario;
}

declare global {
    namespace Express {
        interface Request {
            usuario?: TokenPayload;
        }
    }
}

function ehTokenPayload(valor: unknown): valor is TokenPayload {
    if (typeof valor !== "object" || valor === null) return false;
    const payload = valor as Record<string, unknown>;
    return (
        typeof payload["id"] === "string" &&
        Object.values(PerfilUsuario).includes(payload["perfil"] as PerfilUsuario)
    );
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Token não informado." });
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Token mal formatado." });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

        if (!ehTokenPayload(payload)) {
            return res.status(401).json({ error: "Token inválido ou expirado." });
        }

        req.usuario = { id: payload.id, perfil: payload.perfil };
        return next();
    } catch {
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
}

// Deve ser usado depois do authMiddleware.
export function permitirPerfis(...perfis: PerfilUsuario[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.usuario) {
            return res.status(401).json({ error: "Token não informado." });
        }

        if (!perfis.includes(req.usuario.perfil)) {
            return res.status(403).json({ error: "Você não tem permissão para acessar este recurso." });
        }

        return next();
    };
}

export const somenteAdmin = permitirPerfis(PerfilUsuario.ADMIN);

// Usuário autenticado da requisição (preenchido pelo authMiddleware). Use para
// registrar quem cadastrou algo, em vez de aceitar esse dado do cliente.
export function usuarioLogado(req: Request): TokenPayload {
    if (!req.usuario) {
        throw new AppError(401, "Token não informado.");
    }
    return req.usuario;
}
