import type { Request, Response } from "express";
import { saidaEstoqueRepository } from "../repository/saidaEstoqueRepository";
import { estoqueService } from "../service/estoqueService";
import { usuarioLogado } from "../middleware/authMiddleware";

const repository = new saidaEstoqueRepository();
const service = new estoqueService();

export class saidaEstoqueController {
    async create(req: Request, res: Response) {
        // quem registrou vem do token, nunca do corpo; o estoque do item é baixado
        const saida = await service.registrarSaida({ ...req.body, usuarioId: usuarioLogado(req).id });
        return res.status(201).json(saida);
    }

    async findAll(req: Request, res: Response) {
        const saidas = await repository.findAll();
        return res.status(200).json(saidas);
    }

    async findById(req: Request, res: Response) {
        const saida = await repository.findById(req.params.id as string);
        if (!saida) {
            return res.status(404).json({ error: "Saída de estoque não encontrada." });
        }
        return res.status(200).json(saida);
    }

    async update(req: Request, res: Response) {
        // só finalidade e data (o schema recusa itemId e quantidade)
        const saida = await repository.update(req.params.id as string, req.body);
        return res.status(200).json(saida);
    }

    async delete(req: Request, res: Response) {
        await service.excluirSaida(req.params.id as string);
        return res.status(200).send({"message": "Saída de estoque deletada com sucesso"});
    }
}
