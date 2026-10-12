import type { Request, Response } from "express";
import { StatusAnimal } from "@prisma/client";
import { solicitacaoAdocaoRepository } from "../repository/solicitacaoAdocaoRepository";
import { animalRepository } from "../repository/animalRepository";

const repository = new solicitacaoAdocaoRepository();
const animais = new animalRepository();

export class solicitacaoAdocaoController {
    async create(req: Request, res: Response) {
        // Rota pública: o criarSolicitacaoAdocaoSchema já descartou status, termo e qualquer
        // outro campo enviado; o status nasce sempre PENDENTE (default do schema).
        const { animalId, nomeInteressado, email, telefone, justificativa } = req.body;

        const animal = await animais.findStatusById(animalId);
        if (!animal) {
            return res.status(404).json({ error: "Animal não encontrado." });
        }
        if (animal.status === StatusAnimal.ADOTADO) {
            return res.status(409).json({ error: "Este animal já foi adotado." });
        }

        const solicitacao = await repository.createPublica({
            animal: { connect: { id: animal.id } },
            nomeInteressado,
            email,
            telefone,
            ...(justificativa ? { justificativa } : {}),
        });
        return res.status(201).json(solicitacao);
    }

    async findAll(req: Request, res: Response) {
        const solicitacoes = await repository.findAll();
        return res.status(200).json(solicitacoes);
    }

    async findById(req: Request, res: Response) {
        const solicitacao = await repository.findById(req.params.id as string);
        if (!solicitacao) {
            return res.status(404).json({ error: "Solicitação de adoção não encontrada." });
        }
        return res.status(200).json(solicitacao);
    }

    async update(req: Request, res: Response) {
        const solicitacao = await repository.update(req.params.id as string, req.body);
        return res.status(200).json(solicitacao);
    }

    async delete(req: Request, res: Response) {
        await repository.delete(req.params.id as string);
        return res.status(200).send({"message": "Solicitação de adoção deletada com sucesso"});
    }
}
