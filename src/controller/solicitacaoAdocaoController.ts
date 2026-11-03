import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { solicitacaoAdocaoRepository } from "../repository/solicitacaoAdocaoRepository";
import { adocaoService } from "../service/adocaoService";
import type { FiltrosSolicitacao } from "../validators/solicitacaoAdocaoValidator";

const repository = new solicitacaoAdocaoRepository();
const service = new adocaoService();

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Acrescenta há quantos dias (completos) o interesse foi registrado.
function comDias<T extends { criadoEm: Date }>(solicitacao: T) {
    return {
        ...solicitacao,
        diasDesdeCriacao: Math.max(0, Math.floor((Date.now() - solicitacao.criadoEm.getTime()) / UM_DIA_MS)),
    };
}

export class solicitacaoAdocaoController {
    async findAll(req: Request, res: Response) {
        const filtros = res.locals["consulta"] as FiltrosSolicitacao;
        const where: Prisma.SolicitacaoAdocaoWhereInput = {
            ...(filtros.animalId ? { animalId: filtros.animalId } : {}),
            ...(filtros.status ? { status: filtros.status } : {}),
        };
        const solicitacoes = await repository.findAll(where);
        return res.status(200).json(solicitacoes.map(comDias));
    }

    async findById(req: Request, res: Response) {
        const solicitacao = await repository.findById(req.params.id as string);
        if (!solicitacao) {
            return res.status(404).json({ error: "Solicitação de adoção não encontrada." });
        }
        return res.status(200).json(comDias(solicitacao));
    }

    async marcarEmContato(req: Request, res: Response) {
        const solicitacao = await service.marcarEmContato(req.params.id as string);
        return res.status(200).json(comDias(solicitacao));
    }

    async concluir(req: Request, res: Response) {
        const solicitacao = await service.concluir(req.params.id as string);
        return res.status(200).json(comDias(solicitacao));
    }

    async cancelar(req: Request, res: Response) {
        const solicitacao = await service.cancelar(req.params.id as string);
        return res.status(200).json(comDias(solicitacao));
    }

    async delete(req: Request, res: Response) {
        await service.excluir(req.params.id as string);
        return res.status(200).send({"message": "Solicitação de adoção deletada com sucesso"});
    }
}
