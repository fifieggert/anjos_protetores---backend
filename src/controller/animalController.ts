import type { Request, Response } from "express";
import { animalRepository } from "../repository/animalRepository";
import { animalService } from "../service/animalService";
import { usuarioLogado } from "../middleware/authMiddleware";

const repository = new animalRepository();
const service = new animalService();

export class animalController {
    async create(req: Request, res: Response) {
        // quem cadastrou vem do token, nunca do corpo
        const animal = await repository.create({
            ...req.body,
            usuarioCadastro: { connect: { id: usuarioLogado(req).id } },
        });
        return res.status(201).json(animal);
    }

    async findAll(req: Request, res: Response) {
        const animais = await repository.findAll();
        return res.status(200).json(animais);
    }

    async findById(req: Request, res: Response) {
        const animal = await repository.findById(req.params.id as string);
        if (!animal) {
            return res.status(404).json({ error: "Animal não encontrado." });
        }
        return res.status(200).json(animal);
    }

    async update(req: Request, res: Response) {
        // regras de status (fluxo de adoção) e de castração/vacina ficam no service
        const animal = await service.atualizar(req.params.id as string, req.body);
        return res.status(200).json(animal);
    }

    async delete(req: Request, res: Response) {
        await repository.delete(req.params.id as string);
        return res.status(200).send({"message": "Animal deletado com sucesso"});
    }
}
