import type { z } from "zod";

// Mensagens de erro por campo (caminho "a.b"), no mesmo formato que o middleware validar devolve.
export function errosDe(schema: z.ZodType, dados: unknown): Record<string, string> {
    const resultado = schema.safeParse(dados);
    if (resultado.success) return {};
    const campos: Record<string, string> = {};
    for (const issue of resultado.error.issues) {
        const chaves = issue.code === "unrecognized_keys" ? issue.keys : [issue.path.map(String).join(".")];
        for (const chave of chaves) campos[chave || "corpo"] ??= issue.message;
    }
    return campos;
}
