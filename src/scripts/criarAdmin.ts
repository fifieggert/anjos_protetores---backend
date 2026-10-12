// Cria um usuário com perfil ADMIN para o primeiro acesso ao sistema.
//
// Uso (argumentos):
//   npm run criar-admin -- --nome="Fulana" --cpf=12345678900 --email=admin@exemplo.com --senha=segredo
// Uso (variáveis de ambiente, recomendado para não deixar a senha no histórico do terminal):
//   ADMIN_NOME, ADMIN_CPF, ADMIN_EMAIL, ADMIN_SENHA
import "dotenv/config";
import { parseArgs } from "node:util";
import prisma from "../config/prisma";
import { usuarioRepository } from "../repository/usuarioRepository";
import { gerarHashSenha } from "../utils/senha";

const { values } = parseArgs({
    options: {
        nome: { type: "string" },
        cpf: { type: "string" },
        email: { type: "string" },
        senha: { type: "string" },
    },
});

const nome = values.nome ?? process.env["ADMIN_NOME"];
const cpf = values.cpf ?? process.env["ADMIN_CPF"];
const email = values.email ?? process.env["ADMIN_EMAIL"];
const senha = values.senha ?? process.env["ADMIN_SENHA"];

async function main() {
    if (!nome || !cpf || !email || !senha) {
        console.error(
            "Informe nome, cpf, e-mail e senha via argumentos (--nome, --cpf, --email, --senha) " +
            "ou variáveis de ambiente (ADMIN_NOME, ADMIN_CPF, ADMIN_EMAIL, ADMIN_SENHA)."
        );
        process.exitCode = 1;
        return;
    }

    const repository = new usuarioRepository();

    if (await repository.findByEmail(email)) {
        console.error(`Já existe um usuário cadastrado com o e-mail ${email}.`);
        process.exitCode = 1;
        return;
    }

    const usuario = await repository.create({
        nome,
        cpf,
        email,
        senhaHash: await gerarHashSenha(senha),
        perfil: "ADMIN",
    });

    console.log("Administrador criado com sucesso:", usuario);
}

main()
    .catch((error) => {
        console.error("Erro ao criar administrador:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
