import type { Request, Response } from "express";
import { itemEstoqueRepository } from "../repository/itemEstoqueRepository";

const repository = new itemEstoqueRepository();

export class itemEstoqueController {
    async create(req: Request, res: Response) {
        try {
            const item = await repository.create(req.body);
            return res.status(201).json(item);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao criar item de estoque." });
        }
    }

    async findAll(req: Request, res: Response) {
        try {
            const itens = await repository.findAll();
            return res.status(200).json(itens);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar itens de estoque." });
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const item = await repository.findById(req.params.id as string);
            if (!item) {
                return res.status(404).json({ error: "Item de estoque não encontrado." });
            }
            return res.status(200).json(item);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar item de estoque." });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const item = await repository.update(req.params.id as string, req.body);
            return res.status(200).json(item);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao atualizar item de estoque." });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await repository.delete(req.params.id as string);
            return res.status(200).send({"message": "Item de estoque deletado com sucesso"});
        } catch (error) {
            return res.status(500).json({ error: "Erro ao excluir item de estoque." });
        }
    }
}
