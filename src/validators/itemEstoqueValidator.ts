import { z } from "zod";
import { CategoriaItem } from "@prisma/client";
import { inteiroNaoNegativo, paraAtualizacao, textoObrigatorio } from "./comum";

// quantidadeMinima 0 = sem alerta de estoque baixo.
export const criarItemEstoqueSchema = z.strictObject({
    nomeItem: textoObrigatorio(),
    categoria: z.enum(CategoriaItem),
    quantidadeAtual: inteiroNaoNegativo().default(0),
    quantidadeMinima: inteiroNaoNegativo().default(0),
});

// quantidadeAtual só muda por doações e saídas, nunca pela edição do item.
export const atualizarItemEstoqueSchema = paraAtualizacao(
    z.strictObject({
        nomeItem: textoObrigatorio(),
        categoria: z.enum(CategoriaItem),
        quantidadeMinima: inteiroNaoNegativo(),
    })
);
