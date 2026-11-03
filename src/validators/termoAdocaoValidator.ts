import { z } from "zod";
import { dataOpcional, idSchema } from "./comum";

// Registro da geração do termo. Quem gerou vem do token; o PDF não é guardado.
export const criarTermoAdocaoSchema = z.strictObject({
    animalId: idSchema,
    solicitacaoId: idSchema.optional(),
});

// Marcar o termo como assinado (ou desfazer). Sem assinadoEm, vale o momento atual.
export const atualizarTermoAdocaoSchema = z
    .strictObject({
        assinado: z.boolean(),
        assinadoEm: dataOpcional(),
    })
    .refine((dados) => dados.assinado || dados.assinadoEm === undefined, {
        path: ["assinadoEm"],
        message: "Informe a data de assinatura só quando o termo estiver assinado.",
    });

export type DadosNovoTermo = z.output<typeof criarTermoAdocaoSchema>;
export type DadosAssinaturaTermo = z.output<typeof atualizarTermoAdocaoSchema>;
