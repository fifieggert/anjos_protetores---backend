import { z } from "zod";
import { StatusSolicitacao } from "@prisma/client";
import { MAX_TEXTO, idSchema, paraAtualizacao, textoObrigatorio, textoOpcional } from "./comum";

const camposInteressado = {
    nomeInteressado: textoObrigatorio(),
    email: z.string().trim().pipe(z.email().max(MAX_TEXTO)),
    telefone: textoObrigatorio(),
    justificativa: textoOpcional(),
};

// Formulário público: z.object (não strict) DESCARTA campos extras em vez de
// recusar, mantendo o comportamento anterior — status, termo, id etc. enviados
// pelo cliente são ignorados e a solicitação nasce sempre PENDENTE.
export const criarSolicitacaoAdocaoSchema = z.object({
    animalId: idSchema,
    ...camposInteressado,
});

// Atualização (só ADMIN): dados do interessado e a decisão (status).
// O animal da solicitação não muda.
export const atualizarSolicitacaoAdocaoSchema = paraAtualizacao(
    z.strictObject({
        ...camposInteressado,
        status: z.enum(StatusSolicitacao),
    }),
);
