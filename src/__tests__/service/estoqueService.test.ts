import { describe, expect, it } from "vitest";
import { estoqueService } from "../../service/estoqueService";
import { prismaMock } from "../helpers/prisma";
import { esperarAppError } from "../helpers/erros";

const service = new estoqueService();
const ITEM = "55555555-5555-4555-8555-555555555555";
const USUARIO = "11111111-1111-4111-8111-111111111111";
const ID = "77777777-7777-4777-8777-777777777777";

describe("estoqueService.registrarDoacao", () => {
    const doacao = { itemId: ITEM, usuarioId: USUARIO, quantidade: 5, doador: "Anônimo" };

    it("soma a quantidade ao saldo do item e registra a doação", async () => {
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.doacao.create.mockResolvedValue({ id: ID } as never);

        await expect(service.registrarDoacao(doacao)).resolves.toEqual({ id: ID });
        expect(prismaMock.itemEstoque.updateMany).toHaveBeenCalledWith({
            where: { id: ITEM },
            data: { quantidadeAtual: { increment: 5 } },
        });
        expect(prismaMock.doacao.create).toHaveBeenCalledWith(expect.objectContaining({ data: doacao }));
    });

    it("item inexistente dá 404 sem registrar a doação", async () => {
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 0 });
        await esperarAppError(service.registrarDoacao(doacao), 404, "Item de estoque não encontrado.");
        expect(prismaMock.doacao.create).not.toHaveBeenCalled();
    });
});

describe("estoqueService.registrarSaida", () => {
    const saida = { itemId: ITEM, usuarioId: USUARIO, quantidade: 4, finalidade: "Canil" };

    it("baixa o saldo só se houver quantidade suficiente (UPDATE condicional)", async () => {
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.saidaEstoque.create.mockResolvedValue({ id: ID } as never);

        await service.registrarSaida(saida);
        expect(prismaMock.itemEstoque.updateMany).toHaveBeenCalledWith({
            where: { id: ITEM, quantidadeAtual: { gte: 4 } },
            data: { quantidadeAtual: { decrement: 4 } },
        });
        expect(prismaMock.saidaEstoque.create).toHaveBeenCalledWith(expect.objectContaining({ data: saida }));
    });

    it("saída maior que o saldo falha com 409 e informa o disponível", async () => {
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.itemEstoque.findUnique.mockResolvedValue({ quantidadeAtual: 3 } as never);

        await esperarAppError(service.registrarSaida(saida), 409, "Estoque insuficiente. Disponível: 3.");
        expect(prismaMock.saidaEstoque.create).not.toHaveBeenCalled();
    });

    it("item inexistente dá 404", async () => {
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.itemEstoque.findUnique.mockResolvedValue(null);
        await esperarAppError(service.registrarSaida(saida), 404);
    });
});

describe("estoqueService.excluirDoacao", () => {
    it("excluir a doação tira a quantidade do saldo", async () => {
        prismaMock.doacao.findUnique.mockResolvedValue({ itemId: ITEM, quantidade: 5 } as never);
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 1 });

        await service.excluirDoacao(ID);
        expect(prismaMock.doacao.delete).toHaveBeenCalledWith({ where: { id: ID } });
        expect(prismaMock.itemEstoque.updateMany).toHaveBeenCalledWith({
            where: { id: ITEM, quantidadeAtual: { gte: 5 } },
            data: { quantidadeAtual: { decrement: 5 } },
        });
    });

    it("não deixa o saldo ficar negativo: 409 se o estoque atual é menor que a doação", async () => {
        prismaMock.doacao.findUnique.mockResolvedValue({ itemId: ITEM, quantidade: 5 } as never);
        prismaMock.itemEstoque.updateMany.mockResolvedValue({ count: 0 });
        // o erro dentro da transação desfaz também o delete
        await esperarAppError(service.excluirDoacao(ID), 409, /estoque atual é menor/);
    });

    it("doação inexistente dá 404", async () => {
        prismaMock.doacao.findUnique.mockResolvedValue(null);
        await esperarAppError(service.excluirDoacao(ID), 404, "Doação não encontrada.");
        expect(prismaMock.doacao.delete).not.toHaveBeenCalled();
    });
});

describe("estoqueService.excluirSaida", () => {
    it("excluir a saída devolve a quantidade ao saldo", async () => {
        prismaMock.saidaEstoque.findUnique.mockResolvedValue({ itemId: ITEM, quantidade: 4 } as never);

        await service.excluirSaida(ID);
        expect(prismaMock.saidaEstoque.delete).toHaveBeenCalledWith({ where: { id: ID } });
        expect(prismaMock.itemEstoque.update).toHaveBeenCalledWith({
            where: { id: ITEM },
            data: { quantidadeAtual: { increment: 4 } },
        });
    });

    it("saída inexistente dá 404", async () => {
        prismaMock.saidaEstoque.findUnique.mockResolvedValue(null);
        await esperarAppError(service.excluirSaida(ID), 404, "Saída de estoque não encontrada.");
        expect(prismaMock.itemEstoque.update).not.toHaveBeenCalled();
    });
});
