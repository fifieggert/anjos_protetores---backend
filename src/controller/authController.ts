import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { usuarioRepository } from "../repository/usuarioRepository";
import { compararSenha, gerarHashSenha } from "../utils/senha";
import { JWT_SECRET } from "../config/env";
import type { TokenPayload } from "../middleware/authMiddleware";
import type { LoginDados } from "../validators/authValidator";

const repository = new usuarioRepository();

const MENSAGEM_CREDENCIAIS_INVALIDAS = "E-mail ou senha incorretos.";

// Hash falso: quando o e-mail não existe, a senha é comparada com ele mesmo assim, para a
// resposta levar o mesmo tempo e não revelar quais e-mails estão cadastrados.
// É gerado na primeira vez que for preciso, a partir de bytes aleatórios (ninguém sabe a
// "senha" dele), com o mesmo custo dos hashes reais (gerarHashSenha). Depois é reaproveitado.
let hashFicticio: Promise<string> | undefined;

function obterHashFicticio() {
    hashFicticio ??= gerarHashSenha(randomBytes(32).toString("hex"));
    return hashFicticio;
}

export class authController {
    async login(req: Request, res: Response) {
        // corpo já validado e normalizado pelo validar(loginSchema)
        const { email, senha } = req.body as LoginDados;

        const usuario = await repository.findByEmailComSenha(email);
        const senhaConfere = await compararSenha(senha, usuario?.senhaHash ?? (await obterHashFicticio()));

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
