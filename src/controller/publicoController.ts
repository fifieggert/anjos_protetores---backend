import type { Request, Response } from "express";
import { Especie, Porte } from "@prisma/client";
import { animalRepository } from "../repository/animalRepository";
import type { FiltrosAnimalPublico } from "../repository/animalRepository";

const repository = new animalRepository();

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
        try {
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
        } catch (error) {
            return res.status(500).json({ error: "Erro ao buscar animais disponíveis." });
        }
    }
}
