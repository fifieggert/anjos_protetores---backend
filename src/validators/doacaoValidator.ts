import { z } from "zod";
import { dataOpcional, idSchema, inteiroPositivo, paraAtualizacao, textoObrigatorio } from "./comum";

// usuarioId não é aceito do cliente: vem do token (req.usuario).
const doacaoSchema = z.strictObject({
    itemId: idSchema,
    quantidade: inteiroPositivo(),
    doador: textoObrigatorio(),
    dataEntrada: dataOpcional(),
});

export const criarDoacaoSchema = doacaoSchema;
export const atualizarDoacaoSchema = paraAtualizacao(doacaoSchema);
