import { z } from "zod";
import { MAX_TEXTO, idSchema, paraAtualizacao } from "./comum";

const urlDocumento = z.url({ protocol: /^https?$/ }).max(MAX_TEXTO);

export const criarTermoAdocaoSchema = z.strictObject({
    solicitacaoId: idSchema,
    urlDocumento,
});

// A solicitação vinculada ao termo não muda.
export const atualizarTermoAdocaoSchema = paraAtualizacao(z.strictObject({ urlDocumento }));
