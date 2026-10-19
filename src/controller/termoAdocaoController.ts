import type { Request, Response } from "express";
import { termoAdocaoRepository } from "../repository/termoAdocaoRepository";
import { animalRepository } from "../repository/animalRepository";
import { solicitacaoAdocaoRepository } from "../repository/solicitacaoAdocaoRepository";
import { usuarioLogado } from "../middleware/authMiddleware";
import type { DadosAssinaturaTermo, DadosNovoTermo } from "../validators/termoAdocaoValidator";

const repository = new termoAdocaoRepository();
const animais = new animalRepository();
const solicitacoes = new solicitacaoAdocaoRepository();

export class termoAdocaoController {
    // Registra que o termo foi gerado (a geração do PDF é outra tarefa).
    async create(req: Request, res: Response) {
        const { animalId, solicitacaoId } = req.body as DadosNovoTermo;

        if (!(await animais.exists(animalId))) {
            return res.status(404).json({ error: "Animal não encontrado." });
        }
        if (solicitacaoId) {
            const solicitacao = await solicitacoes.findAnimalId(solicitacaoId);
            if (!solicitacao) {
                return res.status(404).json({ error: "Solicitação de adoção não encontrada." });
            }
            if (solicitacao.animalId !== animalId) {
                return res.status(409).json({ error: "A solicitação informada é de outro animal." });
            }
        }

        // quem gerou vem do token, nunca do corpo
        const termo = await repository.create({
            animalId,
            ...(solicitacaoId ? { solicitacaoId } : {}),
            geradoPorId: usuarioLogado(req).id,
        });
        return res.status(201).json(termo);
    }

    async findAll(req: Request, res: Response) {
        const termos = await repository.findAll();
        return res.status(200).json(termos);
    }

    async findById(req: Request, res: Response) {
        const termo = await repository.findById(req.params.id as string);
        if (!termo) {
            return res.status(404).json({ error: "Termo de adoção não encontrado." });
        }
        return res.status(200).json(termo);
    }

    // Marca como assinado (assinadoEm informado ou agora) ou desfaz (limpa a data).
    async update(req: Request, res: Response) {
        const { assinado, assinadoEm } = req.body as DadosAssinaturaTermo;
        const termo = await repository.update(req.params.id as string, {
            assinado,
            assinadoEm: assinado ? (assinadoEm ?? new Date()) : null,
        });
        return res.status(200).json(termo);
    }

    async delete(req: Request, res: Response) {
        await repository.delete(req.params.id as string);
        return res.status(204).send();
    }
}
