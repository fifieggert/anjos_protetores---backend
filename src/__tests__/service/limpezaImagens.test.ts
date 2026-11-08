import { beforeEach, describe, expect, it, vi } from "vitest";
import { animalService } from "../../service/animalService";
import { eventoService } from "../../service/eventoService";
import { definirArmazenamento } from "../../storage";
import { ArmazenamentoMemoria } from "../helpers/armazenamento";
import { erroPrisma, esperarAppError } from "../helpers/erros";
import { prismaMock } from "../helpers/prisma";

// Limpeza das imagens antigas no armazenamento ao editar ou excluir animais e eventos.
const ID = "44444444-4444-4444-8444-444444444444";
const ANTIGA = "/api/imagens/11111111-1111-4111-8111-111111111111.jpg";
const NOVA = "/api/imagens/22222222-2222-4222-8222-222222222222.webp";
const CHAVE_ANTIGA = "uploads/11111111-1111-4111-8111-111111111111.jpg";
const EXTERNA = "https://exemplo.org/foto.jpg";

let memoria: ArmazenamentoMemoria;

beforeEach(async () => {
    memoria = new ArmazenamentoMemoria();
    definirArmazenamento(memoria);
    await memoria.salvar(CHAVE_ANTIGA, Buffer.from("img"), "image/jpeg");
    prismaMock.animal.count.mockResolvedValue(0);
    prismaMock.evento.count.mockResolvedValue(0);
});

const antigaExiste = () => memoria.arquivos.has(CHAVE_ANTIGA);

describe("animalService: foto antiga", () => {
    const service = new animalService();

    function gravadoCom(fotoUrl: string | null) {
        prismaMock.animal.findUnique.mockResolvedValue({ status: "DISPONIVEL", castrado: false, vacinado: false, fotoUrl } as never);
        prismaMock.animal.update.mockResolvedValue({ id: ID } as never);
    }

    it("trocar a foto apaga a antiga depois do update", async () => {
        gravadoCom(ANTIGA);
        const remover = vi.spyOn(memoria, "remover");
        expect(await service.atualizar(ID, { fotoUrl: NOVA })).toEqual({ id: ID });
        expect(antigaExiste()).toBe(false);
        expect(prismaMock.animal.update.mock.invocationCallOrder[0]).toBeLessThan(remover.mock.invocationCallOrder[0]!);
    });

    it("remover a foto (null) apaga a antiga", async () => {
        gravadoCom(ANTIGA);
        await service.atualizar(ID, { fotoUrl: null });
        expect(antigaExiste()).toBe(false);
    });

    it("mesma foto ou campo não enviado: não apaga", async () => {
        gravadoCom(ANTIGA);
        await service.atualizar(ID, { fotoUrl: ANTIGA });
        await service.atualizar(ID, { nome: "Rex" });
        expect(antigaExiste()).toBe(true);
        expect(prismaMock.animal.count).not.toHaveBeenCalled();
    });

    it("foto antiga externa: nada é apagado", async () => {
        gravadoCom(EXTERNA);
        const remover = vi.spyOn(memoria, "remover");
        await service.atualizar(ID, { fotoUrl: NOVA });
        expect(remover).not.toHaveBeenCalled();
    });

    it("foto compartilhada com outro registro: não apaga", async () => {
        gravadoCom(ANTIGA);
        prismaMock.evento.count.mockResolvedValue(1);
        await service.atualizar(ID, { fotoUrl: NOVA });
        expect(antigaExiste()).toBe(true);
    });

    it("update recusado: não apaga", async () => {
        gravadoCom(ANTIGA);
        await esperarAppError(service.atualizar(ID, { fotoUrl: null, status: "ADOTADO" }), 400);
        prismaMock.animal.update.mockRejectedValue(erroPrisma("P2000"));
        await expect(service.atualizar(ID, { fotoUrl: null })).rejects.toThrow("erro P2000");
        expect(antigaExiste()).toBe(true);
    });

    it("falha do armazenamento não quebra a edição", async () => {
        gravadoCom(ANTIGA);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(memoria, "remover").mockRejectedValue(new Error("S3 fora do ar"));
        await expect(service.atualizar(ID, { fotoUrl: NOVA })).resolves.toEqual({ id: ID });
    });

    it("excluir apaga a foto depois do delete no banco", async () => {
        prismaMock.animal.delete.mockResolvedValue({ fotoUrl: ANTIGA } as never);
        await service.excluir(ID);
        expect(prismaMock.animal.delete).toHaveBeenCalledWith({ where: { id: ID }, select: { fotoUrl: true } });
        expect(antigaExiste()).toBe(false);
    });

    it("excluir que falha no banco não apaga a foto", async () => {
        prismaMock.animal.delete.mockRejectedValue(erroPrisma("P2003"));
        await expect(service.excluir(ID)).rejects.toThrow("erro P2003");
        expect(antigaExiste()).toBe(true);
    });
});

describe("eventoService: imagem antiga", () => {
    const service = new eventoService();
    const gravado = { id: ID, data: new Date("2026-11-14T00:00:00.000Z") };

    function gravadoCom(imagemUrl: string | null) {
        prismaMock.evento.findUnique.mockResolvedValue({ horarioInicio: "09:00", horarioFim: null, imagemUrl } as never);
        prismaMock.evento.update.mockResolvedValue(gravado as never);
    }

    it("trocar a imagem apaga a antiga", async () => {
        gravadoCom(ANTIGA);
        await service.atualizar(ID, { imagemUrl: EXTERNA });
        expect(antigaExiste()).toBe(false);
    });

    it("remover a imagem (null) apaga a antiga", async () => {
        gravadoCom(ANTIGA);
        await service.atualizar(ID, { imagemUrl: null });
        expect(antigaExiste()).toBe(false);
    });

    it("mesma imagem ou campo não enviado: não apaga", async () => {
        gravadoCom(ANTIGA);
        await service.atualizar(ID, { imagemUrl: ANTIGA });
        await service.atualizar(ID, { titulo: "Bazar" });
        expect(antigaExiste()).toBe(true);
    });

    it("imagem antiga externa: nada é apagado", async () => {
        gravadoCom(EXTERNA);
        const remover = vi.spyOn(memoria, "remover");
        await service.atualizar(ID, { imagemUrl: null });
        expect(remover).not.toHaveBeenCalled();
    });

    it("imagem usada por um animal: não apaga", async () => {
        gravadoCom(ANTIGA);
        prismaMock.animal.count.mockResolvedValue(1);
        await service.atualizar(ID, { imagemUrl: null });
        expect(antigaExiste()).toBe(true);
    });

    it("falha do armazenamento não quebra a edição", async () => {
        gravadoCom(ANTIGA);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(memoria, "remover").mockRejectedValue(new Error("S3 fora do ar"));
        await expect(service.atualizar(ID, { imagemUrl: null })).resolves.toMatchObject({ data: "2026-11-14" });
    });

    it("excluir apaga a imagem; sem imagem não apaga nada", async () => {
        prismaMock.evento.delete.mockResolvedValueOnce({ imagemUrl: ANTIGA } as never).mockResolvedValueOnce({ imagemUrl: null } as never);
        await service.excluir(ID);
        expect(prismaMock.evento.delete).toHaveBeenCalledWith({ where: { id: ID }, select: { imagemUrl: true } });
        expect(antigaExiste()).toBe(false);

        const remover = vi.spyOn(memoria, "remover");
        await service.excluir(ID);
        expect(remover).not.toHaveBeenCalled();
    });
});
