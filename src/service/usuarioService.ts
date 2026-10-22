import { PerfilUsuario, Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { usuarioRepository, usuarioSelect } from "../repository/usuarioRepository";
import { compararSenha, gerarHashSenha } from "../utils/senha";
import { emTransacaoSerializavel } from "./transacao";

const repository = new usuarioRepository();

export interface AtualizacaoUsuario extends Omit<Prisma.UsuarioUpdateInput, "senhaHash"> {
    senha?: string;
}

const MENSAGEM_PROPRIO_USUARIO = "Você não pode desativar, rebaixar nem excluir o próprio usuário.";
const MENSAGEM_ULTIMO_ADMIN =
    "Não é possível desativar, rebaixar nem excluir o último administrador ativo. Promova outro usuário a ADMIN antes.";

// O alvo é um ADMIN ativo e deixaria de ser (rebaixado, desativado ou excluído): precisa
// sobrar outro ADMIN ativo. Roda dentro da transação serializável, que trava a contagem
// e impede que dois administradores se rebaixem ao mesmo tempo e o sistema fique sem nenhum.
async function garantirOutroAdminAtivo(tx: Prisma.TransactionClient, idAlvo: string) {
    const outros = await tx.usuario.count({
        where: { perfil: PerfilUsuario.ADMIN, ativo: true, id: { not: idAlvo } },
    });
    if (outros === 0) throw new AppError(409, MENSAGEM_ULTIMO_ADMIN);
}

export class usuarioService {
    async atualizar(id: string, { senha, ...dados }: AtualizacaoUsuario, idLogado: string) {
        // hash fora da transação: o bcrypt é lento e não precisa segurar os locks
        const senhaHash = senha !== undefined ? await gerarHashSenha(senha) : undefined;

        return emTransacaoSerializavel(async (tx) => {
            const alvo = await tx.usuario.findUnique({ where: { id }, select: { perfil: true, ativo: true } });
            if (!alvo) throw new AppError(404, "Usuário não encontrado.");

            const deixaDeSerAdmin = dados.perfil !== undefined && dados.perfil !== PerfilUsuario.ADMIN;
            const desativa = dados.ativo === false;
            if (alvo.perfil === PerfilUsuario.ADMIN && alvo.ativo && (deixaDeSerAdmin || desativa)) {
                if (id === idLogado) throw new AppError(409, MENSAGEM_PROPRIO_USUARIO);
                await garantirOutroAdminAtivo(tx, id);
            }

            return tx.usuario.update({
                where: { id },
                data: { ...dados, ...(senhaHash !== undefined ? { senhaHash } : {}) },
                select: usuarioSelect,
            });
        });
    }

    async excluir(id: string, idLogado: string) {
        if (id === idLogado) throw new AppError(409, MENSAGEM_PROPRIO_USUARIO);

        await emTransacaoSerializavel(async (tx) => {
            const alvo = await tx.usuario.findUnique({ where: { id }, select: { perfil: true, ativo: true } });
            if (!alvo) throw new AppError(404, "Usuário não encontrado.");
            if (alvo.perfil === PerfilUsuario.ADMIN && alvo.ativo) await garantirOutroAdminAtivo(tx, id);
            await tx.usuario.delete({ where: { id } });
        });
    }

    // Troca da própria senha. Senha errada dá 400, não 401: no frontend o 401 encerra a
    // sessão, e errar a senha atual não deve deslogar ninguém.
    async trocarSenha(id: string, senhaAtual: string, novaSenha: string) {
        const usuario = await repository.findByIdComSenha(id);
        // o token continua válido até expirar mesmo depois de o usuário ser desativado
        if (!usuario || !usuario.ativo) throw new AppError(401, "Usuário inativo ou não encontrado.");

        if (!(await compararSenha(senhaAtual, usuario.senhaHash))) {
            throw new AppError(400, "Senha atual incorreta.");
        }

        await repository.update(id, { senhaHash: await gerarHashSenha(novaSenha) });
    }
}
