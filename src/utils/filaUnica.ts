// Fila que executa UMA tarefa por vez, na ordem em que chegaram (encadeando promises).
// A falha de uma tarefa é devolvida só para quem a enfileirou: a próxima roda normalmente.
export function criarFilaUnica() {
    let ultima: Promise<unknown> = Promise.resolve();

    return function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
        const resultado = ultima.then(tarefa);
        // a fila segue para a próxima mesmo se esta falhar
        ultima = resultado.catch(() => undefined);
        return resultado;
    };
}
