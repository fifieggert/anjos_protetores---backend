import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PRAZO_CONEXAO_MS, PRAZO_POOL_MS, opcoesConexaoBanco } from "../../utils/conexaoBanco";

// Todos os valores são falsos. O formato é o mesmo do parâmetro /anjos/database_url do SSM.
const URL_RDS =
    "mysql://anjos:s%2Bnh%40-falsa(1)@anjos-mysql.exemplo.sa-east-1.rds.amazonaws.com:3306/anjos_protetores" +
    "?ssl=true&sslaccept=strict&sslcert=/certs/rds-ca.pem";

describe("opcoesConexaoBanco", () => {
    it("URL de produção: TLS só com a CA do arquivo sslcert, validando o certificado", () => {
        const lerArquivo = vi.fn<(caminho: string) => string>(() => "-----BEGIN CERTIFICATE-----falso");

        const opcoes = opcoesConexaoBanco(URL_RDS, lerArquivo);

        expect(lerArquivo).toHaveBeenCalledWith("/certs/rds-ca.pem");
        expect(opcoes).toEqual({
            host: "anjos-mysql.exemplo.sa-east-1.rds.amazonaws.com",
            port: 3306,
            user: "anjos",
            // a senha volta ao valor original (sem o "URL-encoding")
            password: "s+nh@-falsa(1)",
            database: "anjos_protetores",
            connectTimeout: PRAZO_CONEXAO_MS,
            acquireTimeout: PRAZO_POOL_MS,
            ssl: { ca: "-----BEGIN CERTIFICATE-----falso", rejectUnauthorized: true },
        });
    });

    it("sem leitor informado, lê o certificado do disco", () => {
        const pasta = mkdtempSync(join(tmpdir(), "anjos-ca-"));
        try {
            const arquivo = join(pasta, "ca.pem");
            writeFileSync(arquivo, "-----BEGIN CERTIFICATE-----do-disco");
            const opcoes = opcoesConexaoBanco(`mysql://u:s@db/b?sslcert=${encodeURIComponent(arquivo)}`);
            expect(opcoes.ssl).toEqual({ ca: "-----BEGIN CERTIFICATE-----do-disco", rejectUnauthorized: true });
        } finally {
            rmSync(pasta, { recursive: true, force: true });
        }
    });

    it("prazos curtos: sem banco, a consulta falha em segundos, não em ~17 s", () => {
        expect(PRAZO_CONEXAO_MS).toBeLessThanOrEqual(5_000);
        expect(PRAZO_POOL_MS).toBeLessThanOrEqual(5_000);
    });

    it("desenvolvimento local (sem parâmetros de TLS): sem TLS e porta padrão 3306", () => {
        const opcoes = opcoesConexaoBanco("mysql://anjos:senha@localhost/anjos_protetores");
        expect(opcoes.ssl).toBeUndefined();
        expect(opcoes.port).toBe(3306);
    });

    it.each([
        ["ssl=true", "?ssl=true"],
        ["sslaccept=strict", "?sslaccept=strict"],
    ])("%s sem sslcert: TLS validado com as CAs do Node", (_caso, parametros) => {
        const opcoes = opcoesConexaoBanco(`mysql://u:s@db:3306/b${parametros}`);
        expect(opcoes.ssl).toEqual({ rejectUnauthorized: true });
    });

    it("aceita também o prefixo mariadb://", () => {
        expect(opcoesConexaoBanco("mariadb://u:s@db:3307/b").port).toBe(3307);
    });

    it("recusa sslaccept=accept_invalid_certs (TLS sem validar o certificado)", () => {
        expect(() => opcoesConexaoBanco("mysql://u:s@db/b?sslaccept=accept_invalid_certs")).toThrow(/sslaccept=strict/);
    });

    it("certificado ilegível: erro claro, sem a senha na mensagem", () => {
        const lerArquivo = () => {
            throw new Error("ENOENT");
        };
        expect(() => opcoesConexaoBanco(URL_RDS, lerArquivo)).toThrow(/sslcert.*\/certs\/rds-ca\.pem/);
        expect(() => opcoesConexaoBanco(URL_RDS, lerArquivo)).not.toThrow(/falsa/);
    });

    it.each([
        ["ausente", undefined, /não está definida/],
        ["vazia", "", /não está definida/],
        ["não é URL", "senha-falsa-solta", /inválida/],
        ["outro banco", "postgresql://u:senha-falsa@db/b", /mysql:\/\//],
        ["sem nome do banco", "mysql://u:senha-falsa@db:3306/", /nome do banco/],
    ])("DATABASE_URL %s: erro claro, sem expor a senha", (_caso, url, mensagem) => {
        expect(() => opcoesConexaoBanco(url)).toThrow(mensagem);
        expect(() => opcoesConexaoBanco(url)).not.toThrow(/senha-falsa/);
    });
});
