import { z } from "zod";
import { StatusSolicitacao } from "@prisma/client";
import { idSchema } from "./comum";

// Nome sem espaços nas pontas nem repetidos no meio.
const nomeSchema = z
    .string()
    .transform((valor) => valor.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(2).max(100));

// DDDs em uso no Brasil (Anatel).
const DDDS = new Set([
    11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
    41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
    71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

// Celular brasileiro com DDD (o contato é feito por WhatsApp). Aceita máscara, parênteses,
// espaços, hífen e +55, e devolve só os 11 dígitos: DDD + 9 + 8 dígitos. Fixo não é aceito.
const telefoneSchema = z
    .string()
    .max(30)
    .refine((valor) => /^[\d\s()+.-]*$/.test(valor), {
        message: "Use apenas números, espaços, parênteses, hífen e +55.",
        abort: true,
    })
    .transform((valor) => {
        const digitos = valor.replace(/\D/g, "");
        // com o código do país: 55 + 11 dígitos (ou 55 + 10, que é recusado abaixo).
        // Com 11 dígitos não se remove nada: 55 também é um DDD válido.
        return (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55") ? digitos.slice(2) : digitos;
    })
    .refine((digitos) => /^\d{2}9\d{8}$/.test(digitos) && DDDS.has(Number(digitos.slice(0, 2))), {
        message: "Informe um celular com DDD, por exemplo (47) 99999-9999.",
    });

// Formulário público "tenho interesse". O status não vem do cliente: nasce PENDENTE.
export const registrarInteresseSchema = z.strictObject({
    animalId: idSchema,
    nome: nomeSchema,
    telefone: telefoneSchema,
    aceitaContato: z.literal(true, {
        error: (issue) =>
            issue.input === undefined
                ? "Campo obrigatório."
                : "É preciso autorizar o contato do abrigo para registrar o interesse.",
    }),
});

export type DadosInteresse = z.output<typeof registrarInteresseSchema>;

// Filtros da listagem interna (query string).
export const filtrosSolicitacaoSchema = z.strictObject({
    animalId: idSchema.optional(),
    status: z.enum(StatusSolicitacao).optional(),
});

export type FiltrosSolicitacao = z.output<typeof filtrosSolicitacaoSchema>;

// PATCH: a única mudança livre é PENDENTE -> EM_CONTATO. Concluir e cancelar têm rotas próprias.
export const atualizarStatusSolicitacaoSchema = z.strictObject({
    status: z.literal(StatusSolicitacao.EM_CONTATO, {
        error: (issue) =>
            issue.input === undefined
                ? "Campo obrigatório."
                : "Use EM_CONTATO. Para concluir ou cancelar, use as rotas /concluir e /cancelar.",
    }),
});
