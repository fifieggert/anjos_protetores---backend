interface Fechavel {
    close(callback: (erro?: Error) => void): unknown;
}

interface Processo {
    once(evento: string, ouvinte: () => void): unknown;
}

export interface OpcoesEncerramento {
    processo?: Processo;
    sair?: (codigo: number) => void;
    // tempo máximo para as requisições em andamento terminarem
    prazoMs?: number;
}

// Encerramento limpo (ex.: docker stop / deploy manda SIGTERM): para de aceitar conexões,
// espera as requisições em andamento, desconecta o Prisma e sai. Se passar do prazo, sai
// com erro para o orquestrador não ficar esperando.
export function registrarEncerramento(
    servidor: Fechavel,
    desconectar: () => Promise<void>,
    { processo = process, sair = (codigo) => process.exit(codigo), prazoMs = 10_000 }: OpcoesEncerramento = {},
) {
    let encerrando = false;

    function encerrar(sinal: string) {
        if (encerrando) return;
        encerrando = true;
        console.log(`[servidor] ${sinal} recebido: encerrando...`);

        const limite = setTimeout(() => {
            console.error("[servidor] As conexões não fecharam no prazo; saindo à força.");
            sair(1);
        }, prazoMs);
        limite.unref();

        servidor.close((erroAoFechar) => {
            desconectar()
                .then(
                    () => (erroAoFechar ? 1 : 0),
                    () => 1,
                )
                .then((codigo) => {
                    clearTimeout(limite);
                    sair(codigo);
                });
        });
    }

    for (const sinal of ["SIGTERM", "SIGINT"]) {
        processo.once(sinal, () => encerrar(sinal));
    }
}
