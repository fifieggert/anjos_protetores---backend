import { z } from "zod";
import { dataOpcional, idSchema, inteiroPositivo, paraAtualizacao, textoObrigatorio } from "./comum";

// usuarioId não é aceito do cliente: vem do token (req.usuario).
const saidaEstoqueSchema = z.strictObject({
    itemId: idSchema,
    quantidade: inteiroPositivo(),
    finalidade: textoObrigatorio(),
    dataSaida: dataOpcional(),
});

export const criarSaidaEstoqueSchema = saidaEstoqueSchema;
export const atualizarSaidaEstoqueSchema = paraAtualizacao(saidaEstoqueSchema);
