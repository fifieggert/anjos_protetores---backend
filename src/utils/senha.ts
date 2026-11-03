import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export function gerarHashSenha(senha: string) {
    return bcrypt.hash(senha, SALT_ROUNDS);
}

export function compararSenha(senha: string, senhaHash: string) {
    return bcrypt.compare(senha, senhaHash);
}
