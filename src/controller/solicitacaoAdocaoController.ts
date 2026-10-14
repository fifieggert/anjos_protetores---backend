import type { Request, Response } from "express";
import { StatusAnimal } from "@prisma/client";
import { solicitacaoAdocaoRepository } from "../repository/solicitacaoAdocaoRepository";
import { animalRepository } from "../repository/animalRepository";

const repository = new solicitacaoAdocaoRepository();
const animais = new animalRepository();

// Limite das colunas String do Prisma no MySQL (VARCHAR(191)).
const TAMANHO_MAXIMO = 191;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(valor: unknown) {
    return typeof valor === "string" ? valor.trim() : "";
}

export class solicitacaoAdocaoController {
    async create(req: Request, res: Response) {
        try {
            // Rota pública: aceita só os campos do formulário. Status, termo e qualquer
            // outro campo enviado são ignorados; o status nasce sempre PENDENTE (default do schema).
            const corpo = req.body ?? {};
            const animalId = texto(corpo.animalId);
            const nomeInteressado = texto(corpo.nomeInteressado);
            const email = texto(corpo.email);
            const telefone = texto(corpo.telefone);
            const justificativa = texto(corpo.justificativa);

            if (!animalId || !nomeInteressado || !email || !telefone) {
                return res.status(400).json({ error: "Informe o animal, o nome, o e-mail e o telefone." });
            }

            if (!EMAIL_REGEX.test(email)) {
                return res.status(400).json({ error: "Informe um e-mail válido." });
            }

            if ([nomeInteressado, email, telefone, justificativa].some((campo) => campo.length > TAMANHO_MAXIMO)) {
                return res.status(400).json({ error: `Os campos devem ter no máximo ${TAMANHO_MAXIMO} caracteres.` });
            }

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
