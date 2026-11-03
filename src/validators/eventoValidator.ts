import { z } from "zod";
import { MAX_TEXTO, diaObrigatorio, horarioSchema, paraAtualizacao } from "./comum";

const MIN_TITULO = 3;
const MAX_TITULO = 100;
const MIN_LOCAL = 2;
const MAX_DESCRICAO = 1000;
const MAX_URL_IMAGEM = 500;

// criadoPor não é aceito do cliente: vem do token (req.usuario).
const eventoSchema = z.strictObject({
    titulo: z.string().trim().min(MIN_TITULO, { error: `O título deve ter no mínimo ${MIN_TITULO} caracteres.` }).max(MAX_TITULO),
    descricao: z
        .string()
        .trim()
        .max(MAX_DESCRICAO)
        .nullable()
        .transform((valor) => (valor === "" ? null : valor))
        .optional(),
    data: diaObrigatorio(),
    horarioInicio: horarioSchema(),
    horarioFim: horarioSchema().nullable().optional(),
    local: z.string().trim().min(MIN_LOCAL, { error: `O local deve ter no mínimo ${MIN_LOCAL} caracteres.` }).max(MAX_TEXTO),
    // mesma regra da fotoUrl do animal: só http ou https
    imagemUrl: z.url({ protocol: /^https?$/ }).max(MAX_URL_IMAGEM).nullable().optional(),
});

export const MENSAGEM_HORARIO_FIM = "O horário de término deve ser depois do horário de início.";

// "HH:mm" com zeros à esquerda: comparar o texto equivale a comparar o horário.
export function fimDepoisDoInicio(inicio: string, fim: string | null | undefined) {
    return fim == null || fim > inicio;
}

export const criarEventoSchema = eventoSchema.superRefine((dados, ctx) => {
    if (!fimDepoisDoInicio(dados.horarioInicio, dados.horarioFim)) {
        ctx.addIssue({ code: "custom", path: ["horarioFim"], message: MENSAGEM_HORARIO_FIM });
    }
});

// Na edição o horário é conferido no eventoService, junto com os valores já gravados
// (ex.: enviar só horarioFim).
export const atualizarEventoSchema = paraAtualizacao(eventoSchema);

// Filtro da listagem interna (query string).
export const filtrosEventoSchema = z.strictObject({
    periodo: z.enum(["proximos", "passados", "todos"]).default("todos"),
});

export type FiltrosEvento = z.output<typeof filtrosEventoSchema>;
