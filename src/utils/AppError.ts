// Erro esperado da aplicação: o middleware de erros devolve o status e a
// mensagem como estão. Use para regras que o cliente pode corrigir.
// `campos` segue o formato dos erros de validação: { campo: "mensagem" }.
export class AppError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly campos?: Record<string, string>,
    ) {
        super(message);
        this.name = "AppError";
    }
}
