import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Armazenamento } from "./armazenamento";

// Imagens numa pasta do disco: SOMENTE desenvolvimento e testes manuais. Em produção este
// driver nunca é criado (ver storage/config.ts).
export class ArmazenamentoLocal implements Armazenamento {
    private readonly pasta: string;

    constructor(pasta: string) {
        this.pasta = path.resolve(pasta);
    }

    // Segunda barreira contra path traversal: a chave tem que cair dentro da pasta.
    private caminho(chave: string) {
        const destino = path.resolve(this.pasta, chave);
        if (!destino.startsWith(this.pasta + path.sep)) {
            throw new Error("Chave de armazenamento fora da pasta de uploads.");
        }
        return destino;
    }

    async salvar(chave: string, conteudo: Buffer) {
        const destino = this.caminho(chave);
        await mkdir(path.dirname(destino), { recursive: true });
        await writeFile(destino, conteudo);
    }

    async ler(chave: string) {
        try {
            return await readFile(this.caminho(chave));
        } catch (erro) {
            if ((erro as NodeJS.ErrnoException).code === "ENOENT") return null;
            throw erro;
        }
    }

    async remover(chave: string) {
        await rm(this.caminho(chave), { force: true });
    }
}
