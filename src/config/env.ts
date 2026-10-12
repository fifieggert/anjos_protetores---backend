import "dotenv/config";

function variavelObrigatoria(nome: string): string {
    const valor = process.env[nome];

    if (!valor) {
        console.error(
            `[config] A variável de ambiente ${nome} não está definida. ` +
            `Configure-a no arquivo .env (veja .env.example) e reinicie o servidor.`
        );
        process.exit(1);
    }

    return valor;
}

export const JWT_SECRET = variavelObrigatoria("JWT_SECRET");
