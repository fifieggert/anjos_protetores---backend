import type { Request, Response } from "express";
import { Especie, Porte } from "@prisma/client";
import { animalRepository } from "../repository/animalRepository";
import type { FiltrosAnimalPublico } from "../repository/animalRepository";
import { adocaoService } from "../service/adocaoService";
import type { DadosInteresse } from "../validators/solicitacaoAdocaoValidator";

const repository = new animalRepository();
const adocao = new adocaoService();

// Lê um filtro opcional da query string e confere se é um valor válido do enum.
// Retorna undefined se não veio e null se veio inválido.
function lerFiltro<T extends string>(valor: unknown, permitidos: readonly T[]): T | undefined | null {
    if (valor === undefined || valor === "") return undefined;
    if (typeof valor !== "string") return null;
    const normalizado = valor.trim().toUpperCase();
    return permitidos.find((permitido) => permitido === normalizado) ?? null;
}

export class publicoController {
    async listarAnimais(req: Request, res: Response) {
        const especie = lerFiltro(req.query["especie"], Object.values(Especie));
        const porte = lerFiltro(req.query["porte"], Object.values(Porte));

        if (especie === null) {
            return res.status(400).json({ error: `Espécie inválida. Use: ${Object.values(Especie).join(", ")}.` });
        }
        if (porte === null) {
            return res.status(400).json({ error: `Porte inválido. Use: ${Object.values(Porte).join(", ")}.` });
        }

        const filtros: FiltrosAnimalPublico = {
            ...(especie ? { especie } : {}),
            ...(porte ? { porte } : {}),
        };

        const animais = await repository.findDisponiveis(filtros);
        return res.status(200).json(animais);
    }

    // "Tenho interesse": reserva o animal (EM_ESPERA) e registra a solicitação PENDENTE.
    // A resposta não devolve nenhum dado interno nem os dados enviados.
    async registrarInteresse(req: Request, res: Response) {
        // aceitaContato já foi exigido como true pelo validator; não é gravado
        const { animalId, nome, telefone } = req.body as DadosInteresse;
        await adocao.registrarInteresse({ animalId, nome, telefone });
        return res.status(201).json({ mensagem: "Recebemos seu interesse. O abrigo entrará em contato." });
    }
}
