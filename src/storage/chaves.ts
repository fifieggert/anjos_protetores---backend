// Nomes, chaves e URLs das imagens enviadas. Um único lugar para o formato, usado pelo upload,
// pela rota pública GET /api/imagens/:arquivo, pelos validators de animal e evento e pela
// limpeza das imagens antigas (storage/limparImagem.ts).

export const EXTENSOES_IMAGEM = ["jpg", "png", "webp"] as const;
export type ExtensaoImagem = (typeof EXTENSOES_IMAGEM)[number];

export const TIPOS_MIME: Record<ExtensaoImagem, string> = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
};

// <uuid>.<ext>: só hexadecimal minúsculo e hífen, então não há "/", "\" nem ".." (sem path
// traversal) e o nome é sempre um dos gerados pelo upload.
export const PADRAO_ARQUIVO_IMAGEM = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

// Prefixo das chaves no bucket: a role da EC2 só tem permissão em uploads/*.
export const PREFIXO_CHAVE = "uploads/";
export const PREFIXO_URL_IMAGENS = "/api/imagens/";

export function ehArquivoImagem(arquivo: string): boolean {
    return PADRAO_ARQUIVO_IMAGEM.test(arquivo);
}

// Caminho devolvido pelo upload (ex.: /api/imagens/<uuid>.webp), aceito em fotoUrl e imagemUrl.
export function ehUrlInternaImagem(valor: string): boolean {
    return valor.startsWith(PREFIXO_URL_IMAGENS) && ehArquivoImagem(valor.slice(PREFIXO_URL_IMAGENS.length));
}

export const chaveDaImagem = (arquivo: string) => `${PREFIXO_CHAVE}${arquivo}`;
export const urlDaImagem = (arquivo: string) => `${PREFIXO_URL_IMAGENS}${arquivo}`;

// Valor gravado em fotoUrl/imagemUrl -> chave no armazenamento (uploads/<uuid>.<ext>).
// null para URL externa, vazio ou qualquer valor fora do formato: não é uma imagem nossa.
export function chaveDaUrlInterna(valor: string | null | undefined): string | null {
    if (!valor || !ehUrlInternaImagem(valor)) return null;
    return chaveDaImagem(valor.slice(PREFIXO_URL_IMAGENS.length));
}

// Use só com nomes já validados por ehArquivoImagem.
export function extensaoDoArquivo(arquivo: string): ExtensaoImagem {
    return arquivo.slice(arquivo.lastIndexOf(".") + 1) as ExtensaoImagem;
}
