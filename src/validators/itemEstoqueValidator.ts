import { z } from "zod";
import { CategoriaItem } from "@prisma/client";
import { inteiroNaoNegativo, paraAtualizacao, textoObrigatorio } from "./comum";

const itemEstoqueSchema = z.strictObject({
    nomeItem: textoObrigatorio(),
    categoria: z.enum(CategoriaItem),
    quantidadeAtual: inteiroNaoNegativo(),
    quantidadeMinima: inteiroNaoNegativo(),
});

export const criarItemEstoqueSchema = itemEstoqueSchema;
export const atualizarItemEstoqueSchema = paraAtualizacao(itemEstoqueSchema);
