import prisma from "../config/prisma";
import { obterArmazenamento } from "./index";
import { chaveDaUrlInterna } from "./chaves";

// Apaga do armazenamento as imagens enviadas que deixaram de ser usadas (foto trocada,
// removida ou registro excluído). Chame SEMPRE depois que a gravação no banco deu certo.
//
// Nunca lança: falhar ao apagar (S3 fora do ar, banco indisponível na conferência...) não
// pode quebrar a requisição, que já foi concluída. O erro vai para o log e o arquivo fica
// órfão no bucket, sem efeito para o usuário.

// Todas as colunas que guardam imagem. Ao criar outra, inclua a contagem aqui.
async function imagemEmUso(url: string) {
    const [animais, eventos] = await Promise.all([
        prisma.animal.count({ where: { fotoUrl: url } }),
        prisma.evento.count({ where: { imagemUrl: url } }),
    ]);
    return animais + eventos > 0;
}

// Só o tipo do erro e o status HTTP (do S3): a mensagem pode trazer bucket, região ou valores
// da consulta, que não devem ir para o log.
function descreverErro(erro: unknown) {
    if (!(erro instanceof Error)) return "erro desconhecido";
    const status = (erro as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    return status ? `${erro.name} (HTTP ${status})` : erro.name;
}

// Remove a imagem se ela for nossa (/api/imagens/<uuid>.<ext>) e nenhum registro ainda a usar.
// URL externa, null ou valor inválido: não faz nada.
export async function removerImagemSeOrfa(url: string | null | undefined): Promise<void> {
    const chave = chaveDaUrlInterna(url);
    if (!url || !chave) return;

    try {
        if (await imagemEmUso(url)) return;

        const armazenamento = obterArmazenamento();
        if (!armazenamento) {
            console.warn(`[armazenamento] Imagem ${chave} não removida: armazenamento desabilitado.`);
            return;
        }
        await armazenamento.remover(chave);
    } catch (erro) {
        console.error(`[armazenamento] Falha ao remover a imagem ${chave}: ${descreverErro(erro)}`);
    }
}

// Depois de um update: remove a imagem antiga só se o campo veio no corpo (nova !== undefined)
// com outro valor (outra imagem ou null).
export async function removerImagemSubstituida(antiga: string | null, nova: string | null | undefined) {
    if (nova === undefined || nova === antiga) return;
    await removerImagemSeOrfa(antiga);
}
