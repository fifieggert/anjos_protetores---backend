import path from "node:path";

// Região do projeto (infra/variables.tf). Usada quando AWS_REGION não vem no ambiente.
export const REGIAO_PADRAO = "sa-east-1";

export type ConfigArmazenamento =
    | { driver: "s3"; bucket: string; regiao: string }
    | { driver: "local"; pasta: string }
    | { driver: "desabilitado"; motivo: string };

type Ambiente = Record<string, string | undefined>;

// Decide onde as imagens enviadas ficam, a partir de STORAGE_DRIVER, S3_BUCKET e AWS_REGION.
// - Padrão: s3 em produção, local fora dela.
// - Em produção NUNCA usa disco local (regra do projeto).
// - Configuração incompleta ou inválida não derruba a API: o upload fica desabilitado e a
//   rota responde 503 com o motivo no log de inicialização. O resto do sistema funciona.
export function resolverConfigArmazenamento(ambiente: Ambiente): ConfigArmazenamento {
    const producao = ambiente["NODE_ENV"] === "production";
    const informado = ambiente["STORAGE_DRIVER"]?.trim().toLowerCase();
    const driver = informado || (producao ? "s3" : "local");

    if (driver === "local") {
        if (producao) {
            return { driver: "desabilitado", motivo: "STORAGE_DRIVER=local não é permitido em produção (use s3)." };
        }
        // ./uploads na raiz do projeto (está no .gitignore)
        return { driver: "local", pasta: path.resolve("uploads") };
    }

    if (driver !== "s3") {
        return { driver: "desabilitado", motivo: `STORAGE_DRIVER inválido: "${informado}". Use "local" ou "s3".` };
    }

    const bucket = ambiente["S3_BUCKET"]?.trim();
    if (!bucket) {
        return { driver: "desabilitado", motivo: "S3_BUCKET não está definida." };
    }

    return { driver: "s3", bucket, regiao: ambiente["AWS_REGION"]?.trim() || REGIAO_PADRAO };
}
