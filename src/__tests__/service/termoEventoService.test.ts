import { describe, expect, it } from "vitest";
import { termoAdocaoService } from "../../service/termoAdocaoService";
import { eventoService } from "../../service/eventoService";
import { prismaMock } from "../helpers/prisma";
import { esperarAppError } from "../helpers/erros";
import { ID_ADMIN } from "../helpers/auth";

const ANIMAL = "44444444-4444-4444-8444-444444444444";
const OUTRO_ANIMAL = "88888888-8888-4888-8888-888888888888";
const SOLICITACAO = "66666666-6666-4666-8666-666666666666";
const EVENTO = "99999999-9999-4999-8999-999999999999";

describe("termoAdocaoService.registrarGeracao", () => {
    const service = new termoAdocaoService();

    it("cria um termo novo (criado: true) quando não há termo não assinado", async () => {
        prismaMock.animal.findUnique.mockResolvedValue({ id: ANIMAL } as never);
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue({ animalId: ANIMAL } as never);
        prismaMock.termoAdocao.findFirst.mockResolvedValue(null);
        prismaMock.termoAdocao.create.mockResolvedValue({ id: "novo" } as never);

        await expect(
            service.registrarGeracao({ animalId: ANIMAL, solicitacaoId: SOLICITACAO, geradoPorId: ID_ADMIN }),
        ).resolves.toEqual({ termo: { id: "novo" }, criado: true });
        expect(prismaMock.termoAdocao.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: { animalId: ANIMAL, geradoPorId: ID_ADMIN, solicitacaoId: SOLICITACAO } }),
        );
    });

    it("é idempotente: devolve o termo não assinado existente (criado: false)", async () => {
        prismaMock.animal.findUnique.mockResolvedValue({ id: ANIMAL } as never);
        prismaMock.termoAdocao.findFirst.mockResolvedValue({ id: "existente" } as never);

        await expect(service.registrarGeracao({ animalId: ANIMAL, geradoPorId: ID_ADMIN })).resolves.toEqual({
            termo: { id: "existente" },
            criado: false,
        });
        expect(prismaMock.termoAdocao.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { animalId: ANIMAL, solicitacaoId: null, assinado: false } }),
        );
        expect(prismaMock.termoAdocao.create).not.toHaveBeenCalled();
    });

    it("sem solicitação, o termo novo é criado sem o vínculo", async () => {
        prismaMock.animal.findUnique.mockResolvedValue({ id: ANIMAL } as never);
        prismaMock.termoAdocao.findFirst.mockResolvedValue(null);

        await service.registrarGeracao({ animalId: ANIMAL, geradoPorId: ID_ADMIN });
        expect(prismaMock.solicitacaoAdocao.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.termoAdocao.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: { animalId: ANIMAL, geradoPorId: ID_ADMIN } }),
        );
    });

    it("animal inexistente dá 404", async () => {
        prismaMock.animal.findUnique.mockResolvedValue(null);
        await esperarAppError(service.registrarGeracao({ animalId: ANIMAL, geradoPorId: ID_ADMIN }), 404, /Animal/);
    });

    it("solicitação inexistente dá 404", async () => {
        prismaMock.animal.findUnique.mockResolvedValue({ id: ANIMAL } as never);
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue(null);
        await esperarAppError(
            service.registrarGeracao({ animalId: ANIMAL, solicitacaoId: SOLICITACAO, geradoPorId: ID_ADMIN }),
            404,
            /Solicitação/,
        );
    });

    it("solicitação de outro animal dá 409", async () => {
        prismaMock.animal.findUnique.mockResolvedValue({ id: ANIMAL } as never);
        prismaMock.solicitacaoAdocao.findUnique.mockResolvedValue({ animalId: OUTRO_ANIMAL } as never);
        await esperarAppError(
            service.registrarGeracao({ animalId: ANIMAL, solicitacaoId: SOLICITACAO, geradoPorId: ID_ADMIN }),
            409,
            "A solicitação informada é de outro animal.",
        );
        expect(prismaMock.termoAdocao.create).not.toHaveBeenCalled();
    });
});

describe("eventoService", () => {
    const service = new eventoService();
    const gravado = { id: EVENTO, titulo: "Feira", data: new Date("2026-11-14T00:00:00.000Z") };

    it("criar grava o dia à meia-noite UTC, liga quem criou e devolve AAAA-MM-DD", async () => {
        prismaMock.evento.create.mockResolvedValue(gravado as never);

        const evento = await service.criar(
            { titulo: "Feira", data: "2026-11-14", horarioInicio: "09:00", local: "Praça" },
            ID_ADMIN,
        );

        expect(evento.data).toBe("2026-11-14");
        expect(prismaMock.evento.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    titulo: "Feira",
                    horarioInicio: "09:00",
                    local: "Praça",
                    data: new Date("2026-11-14T00:00:00.000Z"),
                    criadoPor: { connect: { id: ID_ADMIN } },
                },
            }),
        );
    });

    it("atualizar evento inexistente dá 404", async () => {
        prismaMock.evento.findUnique.mockResolvedValue(null);
        await esperarAppError(service.atualizar(EVENTO, { titulo: "X" }), 404, "Evento não encontrado.");
    });

    it.each([
        ["só o fim, antes do início gravado", { horarioFim: "08:00" }],
        ["só o início, depois do fim gravado", { horarioInicio: "12:30" }],
    ])("confere o horário com o gravado: %s dá 400", async (_caso, dados) => {
        prismaMock.evento.findUnique.mockResolvedValue({ horarioInicio: "09:00", horarioFim: "12:00" } as never);
        const erro = await esperarAppError(service.atualizar(EVENTO, dados), 400);
        expect(erro.campos).toEqual({ horarioFim: "O horário de término deve ser depois do horário de início." });
        expect(prismaMock.evento.update).not.toHaveBeenCalled();
    });

    it("limpar o horário de fim (null) com início posterior é aceito", async () => {
        prismaMock.evento.findUnique.mockResolvedValue({ horarioInicio: "09:00", horarioFim: "12:00" } as never);
        prismaMock.evento.update.mockResolvedValue(gravado as never);

        await service.atualizar(EVENTO, { horarioInicio: "13:00", horarioFim: null });
        expect(prismaMock.evento.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { horarioInicio: "13:00", horarioFim: null } }),
        );
    });

    it("converte a data só quando ela vem no corpo", async () => {
        prismaMock.evento.findUnique.mockResolvedValue({ horarioInicio: "09:00", horarioFim: null } as never);
        prismaMock.evento.update.mockResolvedValue(gravado as never);

        const evento = await service.atualizar(EVENTO, { data: "2026-12-01" });
        expect(prismaMock.evento.update.mock.calls[0]?.[0].data).toEqual({ data: new Date("2026-12-01T00:00:00.000Z") });
        expect(evento.data).toBe("2026-11-14");

        await service.atualizar(EVENTO, { titulo: "Bazar" });
        expect(prismaMock.evento.update.mock.calls[1]?.[0].data).toEqual({ titulo: "Bazar" });
    });
});
