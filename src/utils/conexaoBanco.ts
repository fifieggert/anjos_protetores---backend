import { readFileSync } from "node:fs";

// Monta as opções de conexão do driver MariaDB (usado pelo Prisma na API) a partir da
// DATABASE_URL. A mesma URL também é usada pelo "prisma migrate deploy", que entende outros
// parâmetros. Para as duas ferramentas validarem o TLS do mesmo jeito, a API lê aqui os
// parâmetros do Prisma:
//
//   mysql://usuario:senha@host:3306/banco?sslaccept=strict&sslcert=/certs/rds-ca.pem
//
// - sslcert: arquivo com o(s) certificado(s) de autoridade (CA) do banco. Liga o TLS e a API
//   passa a confiar SÓ nesses certificados, validando a cadeia e o nome do servidor.
// - ssl=true (sem sslcert): liga o TLS usando as CAs do Node (+ NODE_EXTRA_CA_CERTS).
// - sslaccept: só "strict" é aceito. Aceitar certificado inválido abriria espaço para um
//   intermediário falso ler a senha do banco, então a API se recusa a subir.
// Sem nenhum desses, a conexão é sem TLS (desenvolvimento local).
// Outros parâmetros da URL são ignorados pela API.

// Tempo para abrir uma conexão TCP + TLS + login. Na mesma região da AWS isso leva poucos
// milissegundos; 3 s já indica banco fora do ar.
export const PRAZO_CONEXAO_MS = 3_000;
// Tempo máximo que uma consulta espera por uma conexão livre do pool. O padrão do driver
// (10 s) fazia a primeira requisição sem banco demorar ~17 s para falhar; com 3 s, ~6 s
// (o adapter faz uma consulta inicial de versão do MySQL antes da consulta da requisição).
export const PRAZO_POOL_MS = 3_000;

export interface OpcoesConexaoBanco {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    connectTimeout: number;
    acquireTimeout: number;
    ssl?: { ca?: string; rejectUnauthorized: true };
}

type LerArquivo = (caminho: string) => string;

const lerArquivoTexto: LerArquivo = (caminho) => readFileSync(caminho, "utf8");

// As mensagens de erro nunca incluem a URL: ela contém a senha do banco.
export function opcoesConexaoBanco(
    databaseUrl: string | undefined,
    lerArquivo: LerArquivo = lerArquivoTexto,
): OpcoesConexaoBanco {
    if (!databaseUrl) {
        throw new Error("DATABASE_URL não está definida.");
    }

    let url: URL;
    try {
        url = new URL(databaseUrl);
    } catch {
        throw new Error("DATABASE_URL inválida: use mysql://usuario:senha@host:porta/banco.");
    }

    if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
        throw new Error("DATABASE_URL deve começar com mysql://.");
    }

    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!database) {
        throw new Error("DATABASE_URL sem o nome do banco (ex.: .../anjos_protetores).");
    }

    const opcoes: OpcoesConexaoBanco = {
        host: url.hostname,
        port: url.port ? Number(url.port) : 3306,
        // a senha vem "URL-encoded" (ex.: + vira %2B); aqui volta ao valor original
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database,
        connectTimeout: PRAZO_CONEXAO_MS,
        acquireTimeout: PRAZO_POOL_MS,
    };

    const parametros = url.searchParams;
    const sslaccept = parametros.get("sslaccept");
    if (sslaccept !== null && sslaccept !== "strict") {
        throw new Error('DATABASE_URL: a API só aceita sslaccept=strict (certificado validado).');
    }

    const sslcert = parametros.get("sslcert");
    if (sslcert) {
        let ca: string;
        try {
            ca = lerArquivo(sslcert);
        } catch {
            throw new Error(`Não foi possível ler o certificado do banco (sslcert): ${sslcert}.`);
        }
        opcoes.ssl = { ca, rejectUnauthorized: true };
    } else if (parametros.get("ssl") === "true" || sslaccept === "strict") {
        opcoes.ssl = { rejectUnauthorized: true };
    }

    return opcoes;
}
