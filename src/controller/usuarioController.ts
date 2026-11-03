import type { Request, Response } from "express";
import { usuarioRepository } from "../repository/usuarioRepository";
import { usuarioService } from "../service/usuarioService";
import type { AtualizacaoUsuario } from "../service/usuarioService";
import { usuarioLogado } from "../middleware/authMiddleware";
import { gerarHashSenha } from "../utils/senha";
import type { DadosTrocaSenha } from "../validators/usuarioValidator";

const repository = new usuarioRepository();
const service = new usuarioService();

export class usuarioController {
    async create(req: Request, res: Response) {
        // A senha chega em texto no campo "senha" (validada pelo criarUsuarioSchema, que
        // recusa senhaHash e qualquer outro campo desconhecido) e só o hash é gravado.
        const { senha, ...dados } = req.body;
        const usuario = await repository.create({
            ...dados,
            senhaHash: await gerarHashSenha(senha),
        });
        return res.status(201).json(usuario);
    }

    async findAll(req: Request, res: Response) {
        const usuarios = await repository.findAll();
        return res.status(200).json(usuarios);
    }

    async findById(req: Request, res: Response) {
        const usuario = await repository.findById(req.params.id as string);
        if (!usuario) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        return res.status(200).json(usuario);
    }

    async findByEmail(req: Request, res: Response) {
        const usuario = await repository.findByEmail(req.params.email as string);
        if (!usuario) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        return res.status(200).json(usuario);
    }

    // Trava: ninguém desativa/rebaixa a si mesmo nem o último ADMIN ativo (ver usuarioService).
    async update(req: Request, res: Response) {
        const usuario = await service.atualizar(
            req.params.id as string,
            req.body as AtualizacaoUsuario,
            usuarioLogado(req).id,
        );
        return res.status(200).json(usuario);
    }

    async delete(req: Request, res: Response) {
        await service.excluir(req.params.id as string, usuarioLogado(req).id);
        return res.status(200).send({"message": "Usuário deletado com sucesso"});
    }

    // Qualquer usuário logado troca a própria senha; o id vem do token, nunca do corpo.
    async trocarSenha(req: Request, res: Response) {
        const { senhaAtual, novaSenha } = req.body as DadosTrocaSenha;
        await service.trocarSenha(usuarioLogado(req).id, senhaAtual, novaSenha);
        return res.status(204).send();
    }
}
