import type { Request, Response } from "express";
import { usuarioRepository } from "../repository/usuarioRepository";
import { gerarHashSenha } from "../utils/senha";

const repository = new usuarioRepository();

export class usuarioController {
    async create(req: Request, res: Response) {
        try {
            // senhaHash nunca é aceito do cliente: a senha chega em texto no campo "senha".
            const { senha, senhaHash: _senhaHash, ...dados } = req.body ?? {};

            if (typeof senha !== "string" || senha.trim() === "") {
                return res.status(400).json({ error: "O campo senha é obrigatório." });
            }

            const usuario = await repository.create({
                ...dados,
                senhaHash: await gerarHashSenha(senha),
            });
            return res.status(201).json(usuario);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao criar usuário." });
        }
    }

    async findAll(req: Request, res: Response) {
        try {
            const usuarios = await repository.findAll();
            return res.status(200).json(usuarios);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar usuários." });
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const usuario = await repository.findById(req.params.id as string);
            if (!usuario) {
                return res.status(404).json({ error: "Usuário não encontrado." });
            }
            return res.status(200).json(usuario);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar usuário." });
        }
    }

    async findByEmail(req: Request, res: Response) {
        try {
            const usuario = await repository.findByEmail(req.params.email as string);
            if (!usuario) {
                return res.status(404).json({ error: "Usuário não encontrado." });
            }
            return res.status(200).json(usuario);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar usuário." });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const { senha, senhaHash: _senhaHash, ...dados } = req.body ?? {};

            if (senha !== undefined && (typeof senha !== "string" || senha.trim() === "")) {
                return res.status(400).json({ error: "A senha informada é inválida." });
            }

            const usuario = await repository.update(req.params.id as string, {
                ...dados,
                ...(senha !== undefined && { senhaHash: await gerarHashSenha(senha) }),
            });
            return res.status(200).json(usuario);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao atualizar usuário." });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await repository.delete(req.params.id as string);
            return res.status(200).send({"message": "Usuário deletado com sucesso"});
        } catch (error) {
            return res.status(500).json({ error: "Erro ao excluir usuário." });
        }
    }
}
