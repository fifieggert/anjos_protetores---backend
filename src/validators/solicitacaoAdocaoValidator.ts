import { z } from "zod";
import { StatusSolicitacao } from "@prisma/client";
import { idSchema } from "./comum";

// Nome sem espaços nas pontas nem repetidos no meio.
const nomeSchema = z
    .string()
    .transform((valor) => valor.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(2).max(100));

// Telefone brasileiro com DDD. Aceita máscara, parênteses, espaços, hífen e +55, e
// devolve só os dígitos: DDD + 8 dígitos (fixo) ou DDD + 9 + 8 dígitos (celular).
const telefoneSchema = z
    .string()
    .max(30)
    .refine((valor) => /^[\d\s()+.-]*$/.test(valor), {
        message: "Use apenas números, espaços, parênteses, hífen e +55.",
        abort: true,
    })
    .transform((valor) => {
        const digitos = valor.replace(/\D/g, "");
        // com o código do país: 55 + 10 ou 11 dígitos
        return (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55") ? digitos.slice(2) : digitos;
    })
    .refine((digitos) => /^[1-9]{2}(9\d{8}|[2-8]\d{7})$/.test(digitos), {
        message: "Telefone inválido. Informe o DDD e o número, ex.: (51) 99999-9999.",
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
