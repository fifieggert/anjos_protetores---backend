import { describe, expect, it } from "vitest";
import { criarFilaUnica } from "../../utils/filaUnica";

// Promise que o teste resolve quando quiser.
function adiada() {
    let liberar!: () => void;
    const promessa = new Promise<void>((resolve) => (liberar = resolve));
    return { promessa, liberar };
}

describe("criarFilaUnica", () => {
    it("executa uma tarefa por vez, na ordem de chegada, e devolve o resultado de cada uma", async () => {
        const naFila = criarFilaUnica();
        const eventos: string[] = [];
        let ativas = 0;
        let maximoAtivas = 0;

        const tarefa = (nome: string, espera: number) => async () => {
            ativas++;
            maximoAtivas = Math.max(maximoAtivas, ativas);
            eventos.push(`início ${nome}`);
            await new Promise((r) => setTimeout(r, espera));
            eventos.push(`fim ${nome}`);
            ativas--;
            return nome;
        };

        // a primeira é a mais lenta: sem a fila, B e C terminariam antes dela
        const resultados = await Promise.all([naFila(tarefa("A", 30)), naFila(tarefa("B", 1)), naFila(tarefa("C", 1))]);

        expect(resultados).toEqual(["A", "B", "C"]);
        expect(maximoAtivas).toBe(1);
        expect(eventos).toEqual(["início A", "fim A", "início B", "fim B", "início C", "fim C"]);
    });

    it("a próxima só começa quando a anterior termina", async () => {
        const naFila = criarFilaUnica();
        const primeira = adiada();
        let segundaComecou = false;

        const p1 = naFila(() => primeira.promessa);
        const p2 = naFila(async () => {
            segundaComecou = true;
        });

        await new Promise((r) => setTimeout(r, 10));
        expect(segundaComecou).toBe(false);

        primeira.liberar();
        await Promise.all([p1, p2]);
        expect(segundaComecou).toBe(true);
    });

    it("uma tarefa que falha (rejeita ou lança) não trava a fila", async () => {
        const naFila = criarFilaUnica();

        const falhaAssincrona = naFila(async () => {
            throw new Error("falhou");
        });
        const falhaSincrona = naFila(() => {
            throw new Error("lançou");
        });
        const depois = naFila(async () => "seguiu");

        await expect(falhaAssincrona).rejects.toThrow("falhou");
        await expect(falhaSincrona).rejects.toThrow("lançou");
        await expect(depois).resolves.toBe("seguiu");
    });

    it("filas diferentes são independentes", async () => {
        const fila1 = criarFilaUnica();
        const fila2 = criarFilaUnica();
        const bloqueio = adiada();

        const presa = fila1(() => bloqueio.promessa);
        await expect(fila2(async () => "livre")).resolves.toBe("livre");

        bloqueio.liberar();
        await presa;
    });
});
