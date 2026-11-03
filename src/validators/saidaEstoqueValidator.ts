import { z } from "zod";
import { dataOpcional, idSchema, inteiroPositivo, paraAtualizacao, textoObrigatorio } from "./comum";

// usuarioId não é aceito do cliente: vem do token (req.usuario).
export const criarSaidaEstoqueSchema = z.strictObject({
    itemId: idSchema,
    quantidade: inteiroPositivo(),
    finalidade: textoObrigatorio(),
    dataSaida: dataOpcional(),
});

// Item e quantidade não mudam depois do registro (o saldo já foi ajustado):
// para corrigir, exclua a saída e registre outra.
export const atualizarSaidaEstoqueSchema = paraAtualizacao(
    z.strictObject({
        finalidade: textoObrigatorio(),
        dataSaida: dataOpcional(),
    })
);
