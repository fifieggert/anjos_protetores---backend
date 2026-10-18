import type { Request, Response } from "express";
import { itemEstoqueRepository } from "../repository/itemEstoqueRepository";

const repository = new itemEstoqueRepository();

export class itemEstoqueController {
    async create(req: Request, res: Response) {
        const item = await repository.create(req.body);
        return res.status(201).json(item);
    }

    async findAll(req: Request, res: Response) {
        const itens = await repository.findAll();
        return res.status(200).json(itens);
    }

    async findAlertas(req: Request, res: Response) {
        const itens = await repository.findAbaixoDoMinimo();
        return res.status(200).json(itens);
    }

    async findById(req: Request, res: Response) {
        const item = await repository.findById(req.params.id as string);
        if (!item) {
            return res.status(404).json({ error: "Item de estoque não encontrado." });
        }
        return res.status(200).json(item);
    }

    async update(req: Request, res: Response) {
        const item = await repository.update(req.params.id as string, req.body);
        return res.status(200).json(item);
    }

    async delete(req: Request, res: Response) {
        await repository.delete(req.params.id as string);
        return res.status(200).send({"message": "Item de estoque deletado com sucesso"});
    }
}
