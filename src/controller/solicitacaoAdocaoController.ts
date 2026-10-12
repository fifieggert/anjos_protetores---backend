import type { Request, Response } from "express";
import { solicitacaoAdocaoRepository } from "../repository/solicitacaoAdocaoRepository";

const repository = new solicitacaoAdocaoRepository();

export class solicitacaoAdocaoController {
    async create(req: Request, res: Response) {
        try {
            const solicitacao = await repository.create(req.body);
            return res.status(201).json(solicitacao);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao criar solicitação de adoção." });
        }
    }

    async findAll(req: Request, res: Response) {
        try {
            const solicitacoes = await repository.findAll();
            return res.status(200).json(solicitacoes);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar solicitações de adoção." });
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const solicitacao = await repository.findById(req.params.id as string);
            if (!solicitacao) {
                return res.status(404).json({ error: "Solicitação de adoção não encontrada." });
            }
            return res.status(200).json(solicitacao);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar solicitação de adoção." });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const solicitacao = await repository.update(req.params.id as string, req.body);
            return res.status(200).json(solicitacao);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao atualizar solicitação de adoção." });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            await repository.delete(req.params.id as string);
            return res.status(200).send({"message": "Solicitação de adoção deletada com sucesso"});
        } catch (error) {
            return res.status(500).json({ error: "Erro ao excluir solicitação de adoção." });
        }
    }
}
