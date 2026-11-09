import { CONFIG_ARMAZENAMENTO } from "../config/env";
import { AppError } from "../utils/AppError";
import type { Armazenamento } from "./armazenamento";
import type { ConfigArmazenamento } from "./config";
import { ArmazenamentoLocal } from "./local";
import { ArmazenamentoS3 } from "./s3";

export type { Armazenamento } from "./armazenamento";

export const MENSAGEM_INDISPONIVEL =
    "O envio de imagens não está disponível no momento: o armazenamento não foi configurado no servidor.";

export function criarArmazenamento(config: ConfigArmazenamento): Armazenamento | null {
    switch (config.driver) {
        case "s3":
            return ArmazenamentoS3.criar(config.bucket, config.regiao);
        case "local":
            return new ArmazenamentoLocal(config.pasta);
        default:
            return null;
    }
}

// Criado na primeira vez que for usado (o cliente do S3 não é montado se ninguém enviar foto).
let atual: Armazenamento | null | undefined;

export function obterArmazenamento(): Armazenamento | null {
    if (atual === undefined) atual = criarArmazenamento(CONFIG_ARMAZENAMENTO);
    return atual;
}

// Troca o armazenamento em uso (os testes usam um em memória). undefined volta ao da configuração.
export function definirArmazenamento(armazenamento: Armazenamento | null | undefined) {
    atual = armazenamento;
}

// Armazenamento em uso ou 503 (ex.: produção sem S3_BUCKET). Nunca cai para o disco local.
export function exigirArmazenamento(): Armazenamento {
    const armazenamento = obterArmazenamento();
    if (!armazenamento) throw new AppError(503, MENSAGEM_INDISPONIVEL);
    return armazenamento;
}
