import { z } from "zod";
import { PerfilUsuario } from "@prisma/client";
import { MAX_TEXTO, paraAtualizacao, textoObrigatorio } from "./comum";

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

const usuarioSchema = z.strictObject({
    nome: textoObrigatorio(),
    cpf,
    email: z.string().trim().pipe(z.email().max(MAX_TEXTO)),
    // bcrypt considera só os primeiros 72 bytes da senha
    senha: z.string().min(8).max(72),
    perfil: z.enum(PerfilUsuario),
    ativo: z.boolean().optional(),
});

export const criarUsuarioSchema = usuarioSchema;
export const atualizarUsuarioSchema = paraAtualizacao(usuarioSchema);
