import type { Request, Response } from "express";
import { doacaoRepository } from "../repository/doacaoRepository";
import { estoqueService } from "../service/estoqueService";
import { usuarioLogado } from "../middleware/authMiddleware";

const repository = new doacaoRepository();
const service = new estoqueService();

export class doacaoController {
    async create(req: Request, res: Response) {
        // quem registrou vem do token, nunca do corpo; o estoque do item é somado
        const doacao = await service.registrarDoacao({ ...req.body, usuarioId: usuarioLogado(req).id });
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
        // só doador e data (o schema recusa itemId e quantidade)
        const doacao = await repository.update(req.params.id as string, req.body);
        return res.status(200).json(doacao);
    }

    async delete(req: Request, res: Response) {
        await service.excluirDoacao(req.params.id as string);
        return res.status(200).send({"message": "Doação deletada com sucesso"});
    }
}
