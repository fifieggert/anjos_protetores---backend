import "dotenv/config";

function encerrarComErro(mensagem: string): never {
    console.error(`[config] ${mensagem}`);
    process.exit(1);
}

function variavelObrigatoria(nome: string): string {
    const valor = process.env[nome];

    if (!valor) {
        encerrarComErro(
            `A variável de ambiente ${nome} não está definida. ` +
            `Configure-a no arquivo .env (veja .env.example) e reinicie o servidor.`
        );
    }

    return valor;
}

// Lista de origens separadas por vírgula, ex.: "http://localhost:5173,https://anjos.org.br".
function origensCors(): string[] {
    const valor = process.env["CORS_ORIGIN"] || "http://localhost:5173";
    const origens = valor.split(",").map((origem) => origem.trim()).filter(Boolean);

    for (const origem of origens) {
        let url: URL;
        try {
            url = new URL(origem);
        } catch {
            encerrarComErro(`CORS_ORIGIN contém uma origem inválida: "${origem}".`);
        }

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            encerrarComErro(`CORS_ORIGIN deve começar com http:// ou https://: "${origem}".`);
        }

        if (url.origin !== origem) {
            encerrarComErro(
                `CORS_ORIGIN deve conter apenas protocolo, domínio e porta, sem barra ou caminho no final: "${origem}" (use "${url.origin}").`
            );
        }
    }

    return origens;
}

export const JWT_SECRET = variavelObrigatoria("JWT_SECRET");
export const CORS_ORIGINS = origensCors();
