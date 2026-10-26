import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registrarEncerramento } from "../../utils/encerramento";

// Servidor HTTP falso: close() chama o callback quando o teste mandar.
function servidorFalso() {
    let concluir: ((erro?: Error) => void) | undefined;
    return {
        close: vi.fn<(callback: (erro?: Error) => void) => void>((callback) => {
            concluir = callback;
        }),
        terminarConexoes: (erro?: Error) => concluir?.(erro),
    };
}

function preparar(opcoes: { desconectar?: () => Promise<void> } = {}) {
    const processo = new EventEmitter();
    const servidor = servidorFalso();
    const desconectar = vi.fn<() => Promise<void>>(opcoes.desconectar ?? (() => Promise.resolve()));
    const sair = vi.fn<(codigo: number) => void>();
    registrarEncerramento(servidor, desconectar, { processo, sair, prazoMs: 10_000 });
    return { processo, servidor, desconectar, sair };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
});

describe("registrarEncerramento", () => {
    it.each(["SIGTERM", "SIGINT"])("%s fecha o servidor HTTP, depois desconecta o Prisma e sai com 0", async (sinal) => {
        const { processo, servidor, desconectar, sair } = preparar();

        processo.emit(sinal);
        expect(servidor.close).toHaveBeenCalledOnce();
        // o Prisma só desconecta depois que as requisições em andamento terminam
        expect(desconectar).not.toHaveBeenCalled();

        servidor.terminarConexoes();
        await vi.waitFor(() => expect(sair).toHaveBeenCalledWith(0));
        expect(desconectar).toHaveBeenCalledOnce();
    });

    it("sem sinal, não faz nada (comportamento normal do servidor)", () => {
        const { servidor, sair } = preparar();
        vi.advanceTimersByTime(60_000);
        expect(servidor.close).not.toHaveBeenCalled();
        expect(sair).not.toHaveBeenCalled();
    });

    it("um segundo sinal durante o encerramento é ignorado", () => {
        const { processo, servidor } = preparar();
        processo.emit("SIGTERM");
        processo.emit("SIGINT");
        expect(servidor.close).toHaveBeenCalledOnce();
    });

    it("se as conexões não fecharem no prazo, força a saída com 1", () => {
        const { processo, sair } = preparar();
        processo.emit("SIGTERM");
        vi.advanceTimersByTime(9_999);
        expect(sair).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(sair).toHaveBeenCalledWith(1);
    });

    it("erro ao fechar o servidor ainda desconecta o Prisma, mas sai com 1", async () => {
        const { processo, servidor, desconectar, sair } = preparar();
        processo.emit("SIGTERM");
        servidor.terminarConexoes(new Error("Server is not running."));
        await vi.waitFor(() => expect(sair).toHaveBeenCalledWith(1));
        expect(desconectar).toHaveBeenCalledOnce();
    });

    it("erro ao desconectar o Prisma sai com 1", async () => {
        const { processo, servidor, sair } = preparar({ desconectar: () => Promise.reject(new Error("falhou")) });
        processo.emit("SIGTERM");
        servidor.terminarConexoes();
        await vi.waitFor(() => expect(sair).toHaveBeenCalledWith(1));
    });

    it("depois de sair normalmente, o prazo não dispara uma segunda saída", async () => {
        const { processo, servidor, sair } = preparar();
        processo.emit("SIGTERM");
        servidor.terminarConexoes();
        await vi.waitFor(() => expect(sair).toHaveBeenCalledWith(0));
        vi.advanceTimersByTime(20_000);
        expect(sair).toHaveBeenCalledOnce();
    });
});
