import { z } from "zod";
import { dataOpcional, idSchema, inteiroPositivo, MAX_TEXTO, paraAtualizacao } from "./comum";

// Doador vazio vira "Anônimo".
const doador = () =>
    z
        .string()
        .trim()
        .max(MAX_TEXTO)
        .transform((valor) => valor || "Anônimo");

// usuarioId não é aceito do cliente: vem do token (req.usuario).
export const criarDoacaoSchema = z.strictObject({
    itemId: idSchema,
    quantidade: inteiroPositivo(),
    doador: doador().nullish().transform((valor) => valor ?? "Anônimo"),
    dataEntrada: dataOpcional(),
});

// Item e quantidade não mudam depois do registro (o saldo já foi ajustado):
// para corrigir, exclua a doação e registre outra.
export const atualizarDoacaoSchema = paraAtualizacao(
    z.strictObject({
        doador: doador(),
        dataEntrada: dataOpcional(),
    })
);
