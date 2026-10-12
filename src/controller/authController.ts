import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { usuarioRepository } from "../repository/usuarioRepository";
import { compararSenha } from "../utils/senha";
import { JWT_SECRET } from "../config/env";
import type { TokenPayload } from "../middleware/authMiddleware";

const repository = new usuarioRepository();

const MENSAGEM_CREDENCIAIS_INVALIDAS = "E-mail ou senha incorretos.";

// Hash bcrypt de uma senha descartável: usado quando o e-mail não existe para que
// a resposta leve o mesmo tempo e não revele quais e-mails estão cadastrados.
const HASH_FICTICIO = "$2b$10$3W3oGYGcej.vM7qlDV/nuuosWOXcwedWNe59F2xpe30JtrntTl2UC";

export class authController {
    async login(req: Request, res: Response) {
        const { email, senha } = req.body ?? {};

        if (typeof email !== "string" || email.trim() === "" ||
            typeof senha !== "string" || senha === "") {
            return res.status(400).json({ error: "Informe e-mail e senha." });
        }

        const usuario = await repository.findByEmailComSenha(email.trim());
        const senhaConfere = await compararSenha(senha, usuario?.senhaHash ?? HASH_FICTICIO);

        if (!usuario || !usuario.ativo || !senhaConfere) {
            return res.status(401).json({ error: MENSAGEM_CREDENCIAIS_INVALIDAS });
        }

        const payload: TokenPayload = { id: usuario.id, perfil: usuario.perfil };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30m" });

        return res.status(200).json({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil,
            },
        });
    }
}
