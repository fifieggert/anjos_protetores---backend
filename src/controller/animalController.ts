import type { Request, Response } from "express";
import { animalRepository } from "../repository/animalRepository";

const repository = new animalRepository();

export class animalController {
    async create(req: Request, res: Response) {
    try {
        const animal = await repository.create(req.body);
        return res.status(201).json(animal);
    } catch (error) {
        console.error(error); // <-- adiciona isso
        return res.status(500).json({ error: "Erro ao criar animal." });
    }
}

    async findAll(req: Request, res: Response) {
        try {
            const animais = await repository.findAll();
            return res.status(200).json(animais);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar animais." });
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const animal = await repository.findById(req.params.id as string);
            if (!animal) {
                return res.status(404).json({ error: "Animal não encontrado." });
            }
            return res.status(200).json(animal);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar animal." });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const animal = await repository.update(req.params.id as string, req.body);
            return res.status(200).json(animal);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao atualizar animal." });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await repository.delete(req.params.id as string);
             return res.status(200).send({"message": "Animal deletado com sucesso"});
        } catch (error) {
            return res.status(500).json({ error: "Erro ao excluir animal." });
        }
    }
}