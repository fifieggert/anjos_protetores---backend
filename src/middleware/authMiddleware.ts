import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { PerfilUsuario } from "@prisma/client";

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

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Token não informado." });
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Token mal formatado." });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        return res.status(500).json({ error: "JWT_SECRET não configurado." });
    }

    try {
        const payload = jwt.verify(token, secret) as TokenPayload;
        req.usuario = payload;
        return next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
}

export function somenteAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.usuario?.perfil !== "ADMIN") {
        return res.status(403).json({ error: "Acesso restrito a administradores." });
    }

    return next();
}
