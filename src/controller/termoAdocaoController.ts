import type { Request, Response } from "express";
import { termoAdocaoRepository } from "../repository/termoAdocaoRepository";
import { termoAdocaoService } from "../service/termoAdocaoService";
import { gerarTermoPdf, nomeArquivoTermo } from "../service/termoPdfService";
import { usuarioLogado } from "../middleware/authMiddleware";
import { ABRIGO_CIDADE, ABRIGO_TELEFONE } from "../config/env";
import type { DadosAssinaturaTermo, DadosNovoTermo } from "../validators/termoAdocaoValidator";

const repository = new termoAdocaoRepository();
const service = new termoAdocaoService();

export class termoAdocaoController {
    // Registra a geração do termo. Idempotente: se já há um termo não assinado para o mesmo
    // animal e a mesma solicitação, devolve esse (200) em vez de criar outro (201).
    async create(req: Request, res: Response) {
        const { animalId, solicitacaoId } = req.body as DadosNovoTermo;
        // quem gerou vem do token, nunca do corpo
        const { termo, criado } = await service.registrarGeracao({
            animalId,
            ...(solicitacaoId ? { solicitacaoId } : {}),
            geradoPorId: usuarioLogado(req).id,
        });
        return res.status(criado ? 201 : 200).json(termo);
    }

    // PDF montado com os dados ATUAIS do banco. Tem nome e telefone do interessado:
    // não fica em cache nem em log.
    async pdf(req: Request, res: Response) {
        const termo = await repository.findParaPdf(req.params.id as string);
        if (!termo) {
            return res.status(404).json({ error: "Termo de adoção não encontrado." });
        }

        const pdf = await gerarTermoPdf(termo, { cidade: ABRIGO_CIDADE, telefoneAbrigo: ABRIGO_TELEFONE });
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${nomeArquivoTermo(termo.animal.nome)}"`,
            "Content-Length": String(pdf.length),
            "Cache-Control": "no-store",
        });
        return res.status(200).send(pdf);
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
