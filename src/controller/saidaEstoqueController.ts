import type { Request, Response } from "express";
import { saidaEstoqueRepository } from "../repository/saidaEstoqueRepository";

const repository = new saidaEstoqueRepository();

export class saidaEstoqueController {
    async create(req: Request, res: Response) {
        try {
            const saida = await repository.create(req.body);
            return res.status(201).json(saida);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao criar saída de estoque." });
        }
    }

    async findAll(req: Request, res: Response) {
        try {
            const saidas = await repository.findAll();
            return res.status(200).json(saidas);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar saídas de estoque." });
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const saida = await repository.findById(req.params.id as string);
            if (!saida) {
                return res.status(404).json({ error: "Saída de estoque não encontrada." });
            }
            return res.status(200).json(saida);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar saída de estoque." });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const saida = await repository.update(req.params.id as string, req.body);
            return res.status(200).json(saida);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao atualizar saída de estoque." });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await repository.delete(req.params.id as string);
            return res.status(200).send({"message": "Saída de estoque deletada com sucesso"});
        } catch (error) {
            return res.status(500).json({ error: "Erro ao excluir saída de estoque." });
        }
    }
}
