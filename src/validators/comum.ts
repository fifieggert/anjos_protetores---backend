import { z } from "zod";

// Limite das colunas String do Prisma no MySQL (VARCHAR(191)).
export const MAX_TEXTO = 191;

const NOMES_TIPO: Record<string, string> = {
    string: "um texto",
    number: "um número",
    int: "um número inteiro",
    boolean: "verdadeiro ou falso",
    object: "um objeto",
    array: "uma lista",
    date: "uma data",
};

const NOMES_FORMATO: Record<string, string> = {
    email: "E-mail inválido.",
    uuid: "Identificador inválido.",
    url: "URL inválida.",
    datetime: "Data inválida. Use o formato AAAA-MM-DD ou AAAA-MM-DDTHH:MM:SSZ.",
    date: "Data inválida. Use o formato AAAA-MM-DD.",
};

// Mensagens em português para os erros mais comuns; o resto cai no locale pt-BR do zod.
z.config(z.locales.ptBR());
z.config({
    customError: (issue) => {
        switch (issue.code) {
            case "invalid_type":
                if (issue.input === undefined) return "Campo obrigatório.";
                if (issue.input === null) return "Não pode ser nulo.";
                return `Deve ser ${NOMES_TIPO[issue.expected] ?? "um valor válido"}.`;
            case "too_small":
                if (issue.origin === "string") {
                    return Number(issue.minimum) <= 1 ? "Não pode ficar vazio." : `Deve ter no mínimo ${issue.minimum} caracteres.`;
                }
                return `Deve ser maior ${issue.inclusive ? "ou igual a" : "que"} ${issue.minimum}.`;
            case "too_big":
                if (issue.origin === "string") return `Deve ter no máximo ${issue.maximum} caracteres.`;
                return `Deve ser menor ${issue.inclusive ? "ou igual a" : "que"} ${issue.maximum}.`;
            case "invalid_format":
                return NOMES_FORMATO[issue.format] ?? "Formato inválido.";
            case "invalid_value":
                if (issue.input === undefined) return "Campo obrigatório.";
                return `Valor inválido. Use: ${issue.values.join(", ")}.`;
            case "unrecognized_keys":
                return "Campo não permitido.";
            default:
                return undefined;
        }
    },
});

export const idSchema = z.uuid();

export const textoObrigatorio = () => z.string().trim().min(1).max(MAX_TEXTO);

// Campos String? do schema: aceita null (ou texto vazio) para limpar o valor.
export const textoOpcional = () =>
    z
        .string()
        .trim()
        .max(MAX_TEXTO)
        .nullable()
        .transform((valor) => (valor === "" ? null : valor))
        .optional();

// O bcrypt considera só os primeiros 72 bytes da senha, então o limite é em bytes
// UTF-8, não em caracteres. Sem trim: espaços fazem parte da senha.
export const MAX_BYTES_SENHA = 72;

export const senhaSchema = z
    .string()
    .min(8)
    .refine((s) => Buffer.byteLength(s, "utf8") <= MAX_BYTES_SENHA, {
        message: "A senha deve ter no máximo 72 bytes (acentos e emojis ocupam mais de um).",
    });

export const inteiroPositivo = () => z.int().min(1);
export const inteiroNaoNegativo = () => z.int().min(0);

// Data opcional informada pelo cliente (ex.: doação registrada depois do recebimento).
export const dataOpcional = () =>
    z
        .union([z.iso.datetime({ offset: true }), z.iso.date()], { error: NOMES_FORMATO["datetime"] })
        .transform((valor) => new Date(valor))
        .optional();

// Campos DateTime? do schema: como dataOpcional, mas aceita null para limpar o valor.
export const dataOpcionalNula = () =>
    z
        .union([z.iso.datetime({ offset: true }), z.iso.date()], { error: NOMES_FORMATO["datetime"] })
        .transform((valor) => new Date(valor))
        .nullable()
        .optional();

// PUT: todos os campos opcionais, mas o corpo não pode vir vazio.
export function paraAtualizacao<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
    return schema
        .partial()
        .strict()
        .refine((dados) => Object.values(dados).some((valor) => valor !== undefined), {
            message: "Informe ao menos um campo para atualizar.",
        });
}
