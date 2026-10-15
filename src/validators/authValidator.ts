import { z } from "zod";
import { MAX_TEXTO } from "./comum";

// Só substitui a mensagem quando o campo não veio; os demais erros (tipo, tamanho)
// usam as mensagens padrão de comum.ts.
const seAusente = (mensagem: string) => (issue: { input?: unknown }) =>
    issue.input === undefined ? mensagem : undefined;

export const loginSchema = z.object({
    // mesma normalização do cadastro (trim + minúsculas) para encontrar o usuário
    email: z
        .string({ error: seAusente("Informe o e-mail.") })
        .trim()
        .toLowerCase()
        .min(1, { error: "Informe o e-mail." })
        .pipe(z.email().max(MAX_TEXTO)),
    // Sem trim: a senha é comparada exatamente como foi digitada. O máximo só evita
    // processar corpos enormes; o limite real de 72 bytes vale no cadastro.
    senha: z
        .string({ error: seAusente("Informe a senha.") })
        .min(1, { error: "Informe a senha." })
        .max(200),
});

export type LoginDados = z.infer<typeof loginSchema>;
