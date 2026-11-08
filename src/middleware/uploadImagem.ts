import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError";
import { exigirArmazenamento } from "../storage";

export const CAMPO_ARQUIVO = "arquivo";
export const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

// memoryStorage: o arquivo fica só na memória (Buffer) até ir para o armazenamento.
// Nada é gravado em disco no servidor.
const receber = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: TAMANHO_MAXIMO,
        files: 1,
        fields: 5,
        fieldSize: 1024,
        parts: 6,
        headerPairs: 50,
    },
}).single(CAMPO_ARQUIVO);

function traduzirErro(erro: unknown): AppError {
    if (erro instanceof multer.MulterError) {
        switch (erro.code) {
            case "LIMIT_FILE_SIZE":
                return new AppError(413, `A imagem deve ter no máximo ${TAMANHO_MAXIMO / 1024 / 1024} MB.`);
            case "LIMIT_FILE_COUNT":
            case "LIMIT_UNEXPECTED_FILE":
                return new AppError(400, `Envie um único arquivo, no campo "${CAMPO_ARQUIVO}".`);
            default:
                return new AppError(400, `Envio inválido. Mande só a imagem no campo "${CAMPO_ARQUIVO}".`);
        }
    }
    // erros do leitor de multipart (corpo cortado, boundary errado...)
    return new AppError(400, "Corpo multipart inválido ou incompleto.");
}

// Recebe o multipart com o campo "arquivo" e traduz os erros para o padrão da API.
export function receberImagem(req: Request, res: Response, next: NextFunction) {
    receber(req, res, (erro?: unknown) => {
        if (erro) return next(traduzirErro(erro));
        return next();
    });
}

// 503 antes de ler o corpo quando o upload está desabilitado (ex.: produção sem S3_BUCKET).
export function armazenamentoDisponivel(_req: Request, _res: Response, next: NextFunction) {
    exigirArmazenamento();
    next();
}
