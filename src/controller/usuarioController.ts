import type { Request, Response } from "express";
import { usuarioRepository } from "../repository/usuarioRepository";
import { gerarHashSenha } from "../utils/senha";

const repository = new usuarioRepository();

export class usuarioController {
    async create(req: Request, res: Response) {
        // A senha chega em texto no campo "senha" (validada pelo criarUsuarioSchema, que
        // recusa senhaHash e qualquer outro campo desconhecido) e só o hash é gravado.
        const { senha, ...dados } = req.body;
        const usuario = await repository.create({
            ...dados,
            senhaHash: await gerarHashSenha(senha),
        });
        return res.status(201).json(usuario);
    }

    async findAll(req: Request, res: Response) {
        const usuarios = await repository.findAll();
        return res.status(200).json(usuarios);
    }

    async findById(req: Request, res: Response) {
        const usuario = await repository.findById(req.params.id as string);
        if (!usuario) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        return res.status(200).json(usuario);
    }

    async findByEmail(req: Request, res: Response) {
        const usuario = await repository.findByEmail(req.params.email as string);
        if (!usuario) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        return res.status(200).json(usuario);
    }

    async update(req: Request, res: Response) {
        const { senha, ...dados } = req.body;
        const usuario = await repository.update(req.params.id as string, {
            ...dados,
            ...(senha !== undefined ? { senhaHash: await gerarHashSenha(senha) } : {}),
        });
        return res.status(200).json(usuario);
    }

    async delete(req: Request, res: Response) {
        await repository.delete(req.params.id as string);
        return res.status(200).send({"message": "Usuário deletado com sucesso"});
    }
}
