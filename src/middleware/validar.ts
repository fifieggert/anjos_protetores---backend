import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";
import { idSchema } from "../validators/comum";

type Campos = Record<string, string>;

function adicionarErros(campos: Campos, issues: z.core.$ZodIssue[], prefixo: string[] = []) {
    for (const issue of issues) {
        const caminho = [...prefixo, ...issue.path.map(String)];

        if (issue.code === "unrecognized_keys") {
            for (const chave of issue.keys) {
                campos[[...caminho, chave].join(".")] ??= issue.message;
            }
            continue;
        }

        campos[caminho.join(".") || "corpo"] ??= issue.message;
    }
}

// Valida o :id da rota (quando existir) e, se houver schema, o corpo. Em caso de
// sucesso o corpo é substituído pela versão validada (campos aparados e convertidos).
export function validar(schema?: z.ZodType) {
    return (req: Request, res: Response, next: NextFunction) => {
        const campos: Campos = {};

        if (req.params["id"] !== undefined) {
            const id = idSchema.safeParse(req.params["id"]);
            if (!id.success) adicionarErros(campos, id.error.issues, ["id"]);
        }

        if (schema) {
            const corpo = schema.safeParse(req.body ?? {});
            if (corpo.success) req.body = corpo.data;
            else adicionarErros(campos, corpo.error.issues);
        }

        if (Object.keys(campos).length > 0) {
            return res.status(400).json({ error: "Dados inválidos.", campos });
        }

        return next();
    };
}
