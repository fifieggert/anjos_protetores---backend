import { describe, expect, it } from "vitest";
import { animalService } from "../../service/animalService";
import type { AtualizacaoAnimal } from "../../service/animalService";
import { prismaMock } from "../helpers/prisma";
import { esperarAppError } from "../helpers/erros";

const service = new animalService();
const ID = "44444444-4444-4444-8444-444444444444";

function animalGravado(atual: { status?: string; castrado?: boolean; vacinado?: boolean } = {}) {
    prismaMock.animal.findUnique.mockResolvedValue({
        status: "DISPONIVEL",
        castrado: false,
        vacinado: false,
        ...atual,
    } as never);
    prismaMock.animal.update.mockResolvedValue({ id: ID } as never);
}

// dados enviados ao banco no update
const dadosGravados = () => prismaMock.animal.update.mock.calls[0]?.[0].data;

describe("animalService.atualizar - status", () => {
    it("animal inexistente dá 404", async () => {
        prismaMock.animal.findUnique.mockResolvedValue(null);
        await esperarAppError(service.atualizar(ID, { nome: "Rex" }), 404, "Animal não encontrado.");
    });

    it.each(["EM_ESPERA", "ADOTADO"] as const)("o PUT nunca define %s", async (status) => {
        animalGravado({ status: "DISPONIVEL" });
        const erro = await esperarAppError(service.atualizar(ID, { status }), 400);
        expect(erro.campos).toEqual({
            status: "Este status só é definido pelo fluxo de adoção (interesse, concluir ou cancelar).",
        });
        expect(prismaMock.animal.update).not.toHaveBeenCalled();
    });

    it("DISPONIVEL -> EM_TRATAMENTO é permitido", async () => {
        animalGravado({ status: "DISPONIVEL" });
        await service.atualizar(ID, { status: "EM_TRATAMENTO" });
        expect(dadosGravados()).toEqual({ status: "EM_TRATAMENTO" });
    });

    it.each(["DISPONIVEL", "EM_TRATAMENTO"] as const)("ADOTADO pode voltar a %s (devolução)", async (status) => {
        animalGravado({ status: "ADOTADO" });
        await service.atualizar(ID, { status });
        expect(dadosGravados()).toEqual({ status });
    });

    it("animal EM_ESPERA não muda de status pelo PUT (409)", async () => {
        animalGravado({ status: "EM_ESPERA" });
        await esperarAppError(service.atualizar(ID, { status: "DISPONIVEL" }), 409, /reservado por um interesse/);
        expect(prismaMock.animal.update).not.toHaveBeenCalled();
    });

    it("reenviar o status atual é aceito e não é gravado (inclusive EM_ESPERA e ADOTADO)", async () => {
        animalGravado({ status: "EM_ESPERA" });
        await service.atualizar(ID, { status: "EM_ESPERA", nome: "Rex" });
        expect(dadosGravados()).toEqual({ nome: "Rex" });
    });

    it("editar outros campos de um animal EM_ESPERA é permitido", async () => {
        animalGravado({ status: "EM_ESPERA" });
        await service.atualizar(ID, { descricao: "Dócil" });
        expect(dadosGravados()).toEqual({ descricao: "Dócil" });
    });
});

describe("animalService.atualizar - castração e vacina", () => {
    const data = new Date("2026-01-10T00:00:00.000Z");

    it("recusa data de castração para animal gravado como não castrado", async () => {
        animalGravado({ castrado: false });
        const erro = await esperarAppError(service.atualizar(ID, { dataCastracao: data }), 400);
        expect(erro.campos).toEqual({ dataCastracao: "Deixe vazio quando o animal não é castrado." });
    });

    it("aceita data de castração para animal já castrado", async () => {
        animalGravado({ castrado: true });
        await service.atualizar(ID, { dataCastracao: data });
        expect(dadosGravados()).toEqual({ dataCastracao: data });
    });

    it("desmarcar castrado limpa a data de castração", async () => {
        animalGravado({ castrado: true });
        await service.atualizar(ID, { castrado: false });
        expect(dadosGravados()).toEqual({ castrado: false, dataCastracao: null });
    });

    it("recusa doses e revacinação para animal gravado como não vacinado", async () => {
        animalGravado({ vacinado: false });
        const erro = await esperarAppError(
            service.atualizar(ID, { dosesVacina: 2, dataRevacinacao: data } as AtualizacaoAnimal),
            400,
        );
        expect(erro.campos).toEqual({
            dosesVacina: "Deixe vazio quando o animal não é vacinado.",
            dataRevacinacao: "Deixe vazio quando o animal não é vacinado.",
        });
    });

    it("desmarcar vacinado limpa doses e revacinação", async () => {
        animalGravado({ vacinado: true });
        await service.atualizar(ID, { vacinado: false });
        expect(dadosGravados()).toEqual({ vacinado: false, dosesVacina: null, dataRevacinacao: null });
    });

    it("marcar castrado e vacinado no mesmo PUT aceita as datas", async () => {
        animalGravado();
        await service.atualizar(ID, { castrado: true, dataCastracao: data, vacinado: true, dosesVacina: 1 });
        expect(dadosGravados()).toEqual({ castrado: true, dataCastracao: data, vacinado: true, dosesVacina: 1 });
    });

    it("roda numa transação serializável", async () => {
        animalGravado();
        await service.atualizar(ID, { nome: "Rex" });
        expect(prismaMock.$transaction.mock.calls[0]?.[1]).toEqual({ isolationLevel: "Serializable" });
    });
});
