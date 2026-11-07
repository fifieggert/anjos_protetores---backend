import type { Armazenamento } from "../../storage/armazenamento";

// Armazenamento falso em memória (ver setup.ts): nenhum teste grava em disco nem fala com a AWS.
export class ArmazenamentoMemoria implements Armazenamento {
    readonly arquivos = new Map<string, { conteudo: Buffer; tipoMime: string }>();

    async salvar(chave: string, conteudo: Buffer, tipoMime: string) {
        this.arquivos.set(chave, { conteudo, tipoMime });
    }

    async ler(chave: string) {
        return this.arquivos.get(chave)?.conteudo ?? null;
    }

    async remover(chave: string) {
        this.arquivos.delete(chave);
    }
}
