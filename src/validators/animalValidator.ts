import { z } from "zod";
import { Especie, Porte, Sexo, StatusAnimal } from "@prisma/client";
import { MAX_TEXTO, dataOpcionalNula, paraAtualizacao, textoObrigatorio, textoOpcional } from "./comum";

// usuarioCadastro não é aceito do cliente: vem do token (req.usuario).
const animalSchema = z.strictObject({
    nome: textoObrigatorio(),
    especie: z.enum(Especie),
    raca: textoOpcional(),
    idade: z.int().min(0).max(40).nullable().optional(),
    porte: z.enum(Porte),
    fotoUrl: z.url({ protocol: /^https?$/ }).max(MAX_TEXTO).nullable().optional(),
    // também é a observação impressa no termo de adoção
    descricao: textoOpcional(),
    sexo: z.enum(Sexo).nullable().optional(),
    castrado: z.boolean().optional(),
    dataCastracao: dataOpcionalNula(),
    vacinado: z.boolean().optional(),
    dosesVacina: z.int().min(0).max(100).nullable().optional(),
    dataRevacinacao: dataOpcionalNula(),
});

type DadosSaude = Partial<
    Pick<z.output<typeof animalSchema>, "castrado" | "dataCastracao" | "vacinado" | "dosesVacina" | "dataRevacinacao">
>;

// Coerência dentro do próprio corpo. Na edição, o animalService confere também com os
// valores já gravados (ex.: enviar só dataCastracao para um animal não castrado).
function conferirSaude(dados: DadosSaude, ctx: z.RefinementCtx) {
    const vazio = "Deixe vazio quando o animal não é";
    if (dados.castrado === false && dados.dataCastracao != null) {
        ctx.addIssue({ code: "custom", path: ["dataCastracao"], message: `${vazio} castrado.` });
    }
    if (dados.vacinado === false && dados.dosesVacina != null) {
        ctx.addIssue({ code: "custom", path: ["dosesVacina"], message: `${vazio} vacinado.` });
    }
    if (dados.vacinado === false && dados.dataRevacinacao != null) {
        ctx.addIssue({ code: "custom", path: ["dataRevacinacao"], message: `${vazio} vacinado.` });
    }
}

// No cadastro o status só pode ser DISPONIVEL ou EM_TRATAMENTO: EM_ESPERA e ADOTADO
// vêm do fluxo de adoção. Sem castrado/vacinado, valem os mesmos padrões do banco (false).
export const criarAnimalSchema = animalSchema
    .extend({ status: z.enum([StatusAnimal.DISPONIVEL, StatusAnimal.EM_TRATAMENTO]).optional() })
    .superRefine((dados, ctx) => conferirSaude({ castrado: false, vacinado: false, ...dados }, ctx));

// Na edição o status aceita qualquer valor do enum; as regras ficam no animalService.
export const atualizarAnimalSchema = paraAtualizacao(animalSchema.extend({ status: z.enum(StatusAnimal) }))
    .superRefine(conferirSaude);
