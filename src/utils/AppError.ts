// Erro esperado da aplicação: o middleware de erros devolve o status e a
// mensagem como estão. Use para regras que o cliente pode corrigir.
export class AppError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = "AppError";
    }
}
