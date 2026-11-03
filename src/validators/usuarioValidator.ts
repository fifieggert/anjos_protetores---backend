import { z } from "zod";
import { PerfilUsuario } from "@prisma/client";
import { MAX_TEXTO, paraAtualizacao, senhaSchema, textoObrigatorio } from "./comum";

function cpfValido(cpf: string) {
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

    const digito = (tamanho: number) => {
        let soma = 0;
        for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };

    return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

// Aceita com ou sem pontuação e grava só os 11 dígitos.
const cpf = z
    .string()
    .transform((valor) => valor.replace(/\D/g, ""))
    .refine(cpfValido, { message: "CPF inválido." });

// Mensagem própria para perfil desconhecido (ex.: o antigo FUNCIONARIO); ausente usa a padrão.
const perfil = z.enum(PerfilUsuario, {
    error: (issue) =>
        issue.input === undefined
            ? undefined
            : `Perfil inválido. Perfis válidos: ${Object.values(PerfilUsuario).join(", ")}.`,
});

const usuarioSchema = z.strictObject({
    nome: textoObrigatorio(),
    cpf,
    // minúsculas para o e-mail gravado ser igual ao procurado no login
    email: z.string().trim().toLowerCase().pipe(z.email().max(MAX_TEXTO)),
    senha: senhaSchema,
    perfil,
    ativo: z.boolean().optional(),
});

export const criarUsuarioSchema = usuarioSchema;
export const atualizarUsuarioSchema = paraAtualizacao(usuarioSchema);

// Troca da própria senha. A nova segue a mesma regra do cadastro (senhaSchema). A atual
// não passa pela regra de força (pode ser de antes dela), só por um teto de tamanho.
export const trocarSenhaSchema = z
    .strictObject({
        senhaAtual: z.string().min(1, { error: "Informe a senha atual." }).max(200),
        novaSenha: senhaSchema,
    })
    .refine((dados) => dados.novaSenha !== dados.senhaAtual, {
        path: ["novaSenha"],
        message: "A nova senha deve ser diferente da atual.",
    });

export type DadosTrocaSenha = z.output<typeof trocarSenhaSchema>;
