import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { eventoRepository } from "../repository/eventoRepository";
import { eventoService } from "../service/eventoService";
import type { AtualizacaoEvento, DadosEvento } from "../service/eventoService";
import { usuarioLogado } from "../middleware/authMiddleware";
import { diaParaBanco, hoje } from "../utils/datas";
import type { FiltrosEvento } from "../validators/eventoValidator";

const repository = new eventoRepository();
const service = new eventoService();

export class eventoController {
    async create(req: Request, res: Response) {
        // quem cadastrou vem do token, nunca do corpo
        const evento = await service.criar(req.body as DadosEvento, usuarioLogado(req).id);
        return res.status(201).json(evento);
    }

    // "proximos" inclui os eventos de hoje (dia no fuso do abrigo).
    async findAll(req: Request, res: Response) {
        const { periodo } = res.locals["consulta"] as FiltrosEvento;
        const diaDeHoje = diaParaBanco(hoje());
        const where: Prisma.EventoWhereInput =
            periodo === "proximos"
                ? { data: { gte: diaDeHoje } }
                : periodo === "passados"
                  ? { data: { lt: diaDeHoje } }
                  : {};
        const eventos = await repository.findAll(where);
        return res.status(200).json(eventos);
    }

    async findById(req: Request, res: Response) {
        const evento = await repository.findById(req.params.id as string);
        if (!evento) {
            return res.status(404).json({ error: "Evento não encontrado." });
        }
        return res.status(200).json(evento);
    }

    async update(req: Request, res: Response) {
        const evento = await service.atualizar(req.params.id as string, req.body as AtualizacaoEvento);
        return res.status(200).json(evento);
    }

    async delete(req: Request, res: Response) {
        await repository.delete(req.params.id as string);
        return res.status(200).send({"message": "Evento deletado com sucesso"});
    }
}
