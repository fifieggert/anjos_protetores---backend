import type { Request, Response } from "express";
import { doacaoRepository } from "../repository/doacaoRepository";
import { usuarioLogado } from "../middleware/authMiddleware";

const repository = new doacaoRepository();

export class doacaoController {
    async create(req: Request, res: Response) {
        const { itemId, ...dados } = req.body;
        // quem registrou vem do token, nunca do corpo
        const doacao = await repository.create({
            ...dados,
            item: { connect: { id: itemId } },
            usuario: { connect: { id: usuarioLogado(req).id } },
        });
        return res.status(201).json(doacao);
    }

    async findAll(req: Request, res: Response) {
        const doacoes = await repository.findAll();
        return res.status(200).json(doacoes);
    }

    async findById(req: Request, res: Response) {
        const doacao = await repository.findById(req.params.id as string);
        if (!doacao) {
            return res.status(404).json({ error: "Doação não encontrada." });
        }
        return res.status(200).json(doacao);
    }

    async update(req: Request, res: Response) {
        const { itemId, ...dados } = req.body;
        const doacao = await repository.update(req.params.id as string, {
            ...dados,
            ...(itemId ? { item: { connect: { id: itemId } } } : {}),
        });
        return res.status(200).json(doacao);
    }

    async delete(req: Request, res: Response) {
        await repository.delete(req.params.id as string);
        return res.status(200).send({"message": "Doação deletada com sucesso"});
    }
}
