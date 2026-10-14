import type { Request, Response } from "express";
import { doacaoRepository } from "../repository/doacaoRepository";

const repository = new doacaoRepository();

export class doacaoController {
    async create(req: Request, res: Response) {
        try {
            const doacao = await repository.create(req.body);
            return res.status(201).json(doacao);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao criar doação." });
        }
    }

    async findAll(req: Request, res: Response) {
        try {
            const doacoes = await repository.findAll();
            return res.status(200).json(doacoes);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar doações." });
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const doacao = await repository.findById(req.params.id as string);
            if (!doacao) {
                return res.status(404).json({ error: "Doação não encontrada." });
            }
            return res.status(200).json(doacao);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar doação." });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const doacao = await repository.update(req.params.id as string, req.body);
            return res.status(200).json(doacao);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao atualizar doação." });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await repository.delete(req.params.id as string);
            return res.status(200).send({"message": "Doação deletada com sucesso"});
        } catch (error) {
            return res.status(500).json({ error: "Erro ao excluir doação." });
        }
    }
}
