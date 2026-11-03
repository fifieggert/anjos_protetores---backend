import { describe, expect, it } from "vitest";
import { adocaoService } from "../../service/adocaoService";
import { prismaMock } from "../helpers/prisma";
import { esperarAppError } from "../helpers/erros";

const service = new adocaoService();
const ANIMAL = "44444444-4444-4444-8444-444444444444";
const SOLICITACAO = "66666666-6666-4666-8666-666666666666";
const interesse = { animalId: ANIMAL, nome: "Ana", telefone: "47999998888" };
const EM_ANDAMENTO = { in: ["PENDENTE", "EM_CONTATO"] };

function solicitacaoGravada(status: string) {
    prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue({ id: SOLICITACAO, animalId: ANIMAL, status } as never);
}

describe("adocaoService.registrarInteresse", () => {
    it("reserva o animal DISPONIVEL (vira EM_ESPERA) e cria a solicitação", async () => {
        prismaMock.solicitacaoAdocao.findFirst.mockResolvedValue(null);
        prismaMock.animal.updateMany.mockResolvedValue({ count: 1 });

        await service.registrarInteresse(interesse);

        expect(prismaMock.animal.updateMany).toHaveBeenCalledWith({
            where: { id: ANIMAL, status: "DISPONIVEL" },
            data: { status: "EM_ESPERA" },
        });
        expect(prismaMock.solicitacaoAdocao.create).toHaveBeenCalledWith({ data: interesse, select: { id: true } });
        expect(prismaMock.$transaction.mock.calls[0]?.[1]).toEqual({ isolationLevel: "Serializable" });
    });

    it("não deixa o mesmo telefone ter dois interesses em andamento", async () => {
        prismaMock.solicitacaoAdocao.findFirst.mockResolvedValue({ id: SOLICITACAO } as never);

        await esperarAppError(service.registrarInteresse(interesse), 409, /já tem um interesse em andamento/);

        expect(prismaMock.solicitacaoAdocao.findFirst).toHaveBeenCalledWith({
            where: { telefone: interesse.telefone, status: EM_ANDAMENTO },
            select: { id: true },
        });
        expect(prismaMock.animal.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.solicitacaoAdocao.create).not.toHaveBeenCalled();
    });

    it("só um interesse aberto por animal: animal já reservado ou adotado dá 409", async () => {
        prismaMock.solicitacaoAdocao.findFirst.mockResolvedValue(null);
        prismaMock.animal.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.animal.findUnique.mockResolvedValue({ id: ANIMAL } as never);

        await esperarAppError(service.registrarInteresse(interesse), 409, "Este animal já tem alguém interessado no momento.");
        expect(prismaMock.solicitacaoAdocao.create).not.toHaveBeenCalled();
    });

    it("animal inexistente dá 404", async () => {
        prismaMock.solicitacaoAdocao.findFirst.mockResolvedValue(null);
        prismaMock.animal.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.animal.findUnique.mockResolvedValue(null);

        await esperarAppError(service.registrarInteresse(interesse), 404, "Animal não encontrado.");
        expect(prismaMock.solicitacaoAdocao.create).not.toHaveBeenCalled();
    });
});

describe("adocaoService.marcarEmContato", () => {
    it("muda PENDENTE para EM_CONTATO e devolve a solicitação", async () => {
        prismaMock.solicitacaoAdocao.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.solicitacaoAdocao.findUniqueOrThrow.mockResolvedValue({ id: SOLICITACAO, status: "EM_CONTATO" } as never);

        await expect(service.marcarEmContato(SOLICITACAO)).resolves.toMatchObject({ status: "EM_CONTATO" });
        expect(prismaMock.solicitacaoAdocao.updateMany).toHaveBeenCalledWith({
            where: { id: SOLICITACAO, status: "PENDENTE" },
            data: { status: "EM_CONTATO" },
        });
        // marcar em contato não mexe no animal (ele continua EM_ESPERA)
        expect(prismaMock.animal.updateMany).not.toHaveBeenCalled();
    });

    it("solicitação que não está pendente dá 409", async () => {
        prismaMock.solicitacaoAdocao.updateMany.mockResolvedValue({ count: 0 });
        solicitacaoGravada("APROVADA");
        await esperarAppError(service.marcarEmContato(SOLICITACAO), 409, /pendente/);
    });

    it("solicitação inexistente dá 404", async () => {
        prismaMock.solicitacaoAdocao.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue(null);
        await esperarAppError(service.marcarEmContato(SOLICITACAO), 404);
    });
});

describe.each([
    ["concluir", "APROVADA", "ADOTADO"],
    ["cancelar", "RECUSADA", "DISPONIVEL"],
] as const)("adocaoService.%s", (acao, statusSolicitacao, statusAnimal) => {
    it(`marca a solicitação ${statusSolicitacao} e o animal EM_ESPERA vira ${statusAnimal}`, async () => {
        solicitacaoGravada("EM_CONTATO");
        prismaMock.solicitacaoAdocao.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.animal.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.solicitacaoAdocao.findUniqueOrThrow.mockResolvedValue({ id: SOLICITACAO, status: statusSolicitacao } as never);

        await expect(service[acao](SOLICITACAO)).resolves.toMatchObject({ status: statusSolicitacao });

        expect(prismaMock.solicitacaoAdocao.updateMany).toHaveBeenCalledWith({
            where: { id: SOLICITACAO, status: EM_ANDAMENTO },
            data: { status: statusSolicitacao },
        });
        expect(prismaMock.animal.updateMany).toHaveBeenCalledWith({
            where: { id: ANIMAL, status: "EM_ESPERA" },
            data: { status: statusAnimal },
        });
    });

    it("solicitação já encerrada dá 409 e não mexe no animal", async () => {
        solicitacaoGravada("RECUSADA");
        prismaMock.solicitacaoAdocao.updateMany.mockResolvedValue({ count: 0 });

        await esperarAppError(service[acao](SOLICITACAO), 409, "Esta solicitação não está mais em andamento.");
        expect(prismaMock.animal.updateMany).not.toHaveBeenCalled();
    });

    it("animal que não está EM_ESPERA dá 409", async () => {
        solicitacaoGravada("PENDENTE");
        prismaMock.solicitacaoAdocao.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.animal.updateMany.mockResolvedValue({ count: 0 });

        await esperarAppError(service[acao](SOLICITACAO), 409, "O animal desta solicitação não está em espera por ela.");
        expect(prismaMock.solicitacaoAdocao.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("solicitação inexistente dá 404", async () => {
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue(null);
        await esperarAppError(service[acao](SOLICITACAO), 404, "Solicitação de adoção não encontrada.");
    });
});

describe("adocaoService.excluir", () => {
    it.each(["PENDENTE", "EM_CONTATO"])("interesse %s em andamento: devolve o animal para DISPONIVEL", async (status) => {
        solicitacaoGravada(status);

        await service.excluir(SOLICITACAO);

        expect(prismaMock.animal.updateMany).toHaveBeenCalledWith({
            where: { id: ANIMAL, status: "EM_ESPERA" },
            data: { status: "DISPONIVEL" },
        });
        expect(prismaMock.solicitacaoAdocao.delete).toHaveBeenCalledWith({ where: { id: SOLICITACAO } });
    });

    it.each(["APROVADA", "RECUSADA"])("solicitação %s: exclui sem mexer no animal", async (status) => {
        solicitacaoGravada(status);

        await service.excluir(SOLICITACAO);

        expect(prismaMock.animal.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.solicitacaoAdocao.delete).toHaveBeenCalledWith({ where: { id: SOLICITACAO } });
    });

    it("solicitação inexistente dá 404", async () => {
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue(null);
        await esperarAppError(service.excluir(SOLICITACAO), 404);
        expect(prismaMock.solicitacaoAdocao.delete).not.toHaveBeenCalled();
    });
});
