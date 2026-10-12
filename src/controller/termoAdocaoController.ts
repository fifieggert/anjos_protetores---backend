import type { Request, Response } from "express";
import { termoAdocaoRepository } from "../repository/termoAdocaoRepository";

const repository = new termoAdocaoRepository();

export class termoAdocaoController {
    async create(req: Request, res: Response) {
        try {
            const termo = await repository.create(req.body);
            return res.status(201).json(termo);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao criar termo de adoção." });
        }
    }

    async findAll(req: Request, res: Response) {
        try {
            const termos = await repository.findAll();
            return res.status(200).json(termos);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar termos de adoção." });
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const termo = await repository.findById(req.params.id as string);
            if (!termo) {
                return res.status(404).json({ error: "Termo de adoção não encontrado." });
            }
            return res.status(200).json(termo);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar termo de adoção." });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const termo = await repository.update(req.params.id as string, req.body);
            return res.status(200).json(termo);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao atualizar termo de adoção." });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await repository.delete(req.params.id as string);
            return res.status(204).send();
        } catch (error) {
            return res.status(500).json({ error: "Erro ao excluir termo de adoção." });
        }
    }
}