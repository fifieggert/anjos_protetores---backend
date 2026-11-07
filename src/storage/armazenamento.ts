// Contrato dos lugares onde os arquivos enviados ficam guardados (S3 em produção, pasta
// local só no desenvolvimento). A chave é o caminho do arquivo, ex.: uploads/<uuid>.jpg.
// Quem chama é responsável por gerar e validar a chave (ver storage/chaves.ts).
export interface Armazenamento {
    salvar(chave: string, conteudo: Buffer, tipoMime: string): Promise<void>;
    // null quando o arquivo não existe
    ler(chave: string): Promise<Buffer | null>;
    // não falha se o arquivo já não existir
    remover(chave: string): Promise<void>;
}
