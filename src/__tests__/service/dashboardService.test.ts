import { describe, expect, it, vi } from "vitest";
import { mockGroupBy, prismaMock } from "../helpers/prisma";
import { dashboardService } from "../../service/dashboardService";

const service = new dashboardService();

// Resultados falsos das consultas. groupBy só devolve linha para o que existe no banco.
function bancoCom(
    dados: {
        animaisPorStatus?: { status: string; total: number }[];
        animaisPorEspecie?: { especie: string; total: number }[];
        solicitacoesPorStatus?: { status: string; total: number }[];
        // adoções concluídas por mês, pela data de início do mês (ISO)
        adocoesPorInicioDoMes?: Record<string, number>;
        itensEmAlerta?: { id: string; nomeItem: string; quantidadeAtual: number; quantidadeMinima: number }[];
        doacoesNoMes?: number;
        doacoesRecentes?: unknown[];
        eventos?: unknown[];
    } = {},
) {
    const comContagem = <T extends object>(linhas: (T & { total: number })[] = []) =>
        linhas.map(({ total, ...resto }) => ({ ...resto, _count: { _all: total } }));

    mockGroupBy(prismaMock.animal.groupBy).mockImplementation(((args: { by: string[] }) =>
        Promise.resolve(
            args.by[0] === "status" ? comContagem(dados.animaisPorStatus) : comContagem(dados.animaisPorEspecie),
        )) as never);
    mockGroupBy(prismaMock.solicitacaoAdocao.groupBy).mockResolvedValue(comContagem(dados.solicitacoesPorStatus) as never);
    prismaMock.solicitacaoAdocao.count.mockImplementation(((args: { where: { atualizadoEm: { gte: Date } } }) =>
        Promise.resolve(dados.adocoesPorInicioDoMes?.[args.where.atualizadoEm.gte.toISOString()] ?? 0)) as never);
    prismaMock.itemEstoque.findMany.mockResolvedValue((dados.itensEmAlerta ?? []) as never);
    prismaMock.doacao.count.mockResolvedValue(dados.doacoesNoMes ?? 0);
    prismaMock.doacao.findMany.mockResolvedValue((dados.doacoesRecentes ?? []) as never);
    prismaMock.evento.findMany.mockResolvedValue((dados.eventos ?? []) as never);
}

describe("dashboardService.resumo", () => {
    it("banco vazio: todos os status, espécies e meses aparecem com 0", async () => {
        bancoCom();

        const painel = await service.resumo();

        expect(painel).toEqual({
            animais: {
                total: 0,
                porStatus: { DISPONIVEL: 0, EM_TRATAMENTO: 0, EM_ESPERA: 0, ADOTADO: 0 },
                porEspecie: [
                    { especie: "CACHORRO", total: 0 },
                    { especie: "GATO", total: 0 },
                    { especie: "OUTRO", total: 0 },
                ],
            },
            adocoes: {
                pendentes: 0,
                emContato: 0,
                concluidasNoMes: 0,
                concluidasTotal: 0,
                porMes: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((mes) => ({ mes, total: 0 })),
            },
            estoque: { itensAbaixoDoMinimo: 0, itens: [] },
            doacoes: { totalNoMes: 0, recentes: [] },
            eventos: { proximos: [] },
        });
    });

    it("animais: total é a soma dos status; status e espécies sem animal ficam com 0", async () => {
        bancoCom({
            animaisPorStatus: [
                { status: "DISPONIVEL", total: 7 },
                { status: "ADOTADO", total: 12 },
                { status: "EM_ESPERA", total: 1 },
            ],
            animaisPorEspecie: [
                { especie: "GATO", total: 8 },
                { especie: "CACHORRO", total: 12 },
            ],
        });

        const { animais } = await service.resumo();

        expect(animais.total).toBe(20);
        expect(animais.porStatus).toEqual({ DISPONIVEL: 7, EM_TRATAMENTO: 0, EM_ESPERA: 1, ADOTADO: 12 });
        // sempre na ordem do enum, mesmo que o banco devolva em outra
        expect(animais.porEspecie).toEqual([
            { especie: "CACHORRO", total: 12 },
            { especie: "GATO", total: 8 },
            { especie: "OUTRO", total: 0 },
        ]);
        // contagem no banco, sem carregar os animais
        expect(prismaMock.animal.findMany).not.toHaveBeenCalled();
        expect(prismaMock.animal.groupBy).toHaveBeenCalledWith({ by: ["status"], _count: { _all: true } });
        expect(prismaMock.animal.groupBy).toHaveBeenCalledWith({ by: ["especie"], _count: { _all: true } });
    });

    it("adoções: pendentes, em contato, total concluído e os 6 meses em ordem crescente", async () => {
        bancoCom({
            solicitacoesPorStatus: [
                { status: "PENDENTE", total: 3 },
                { status: "EM_CONTATO", total: 2 },
                { status: "APROVADA", total: 40 },
                { status: "RECUSADA", total: 9 },
            ],
            adocoesPorInicioDoMes: {
                "2026-06-01T03:00:00.000Z": 4,
                "2026-09-01T03:00:00.000Z": 1,
                "2026-10-01T03:00:00.000Z": 2,
            },
        });

        const { adocoes } = await service.resumo();

        expect(adocoes).toEqual({
            pendentes: 3,
            emContato: 2,
            concluidasNoMes: 2,
            concluidasTotal: 40,
            porMes: [
                { mes: "2026-05", total: 0 },
                { mes: "2026-06", total: 4 },
                { mes: "2026-07", total: 0 },
                { mes: "2026-08", total: 0 },
                { mes: "2026-09", total: 1 },
                { mes: "2026-10", total: 2 },
            ],
        });
        // uma contagem por mês: APROVADA, com o mês de Brasília como intervalo [início, fim)
        expect(prismaMock.solicitacaoAdocao.count).toHaveBeenCalledTimes(6);
        expect(prismaMock.solicitacaoAdocao.count).toHaveBeenCalledWith({
            where: {
                status: "APROVADA",
                atualizadoEm: { gte: new Date("2026-10-01T03:00:00.000Z"), lt: new Date("2026-11-01T03:00:00.000Z") },
            },
        });
    });

    it("não lê nome nem telefone de interessados (só contagens das solicitações)", async () => {
        bancoCom();
        await service.resumo();
        expect(prismaMock.solicitacaoAdocao.findMany).not.toHaveBeenCalled();
        expect(prismaMock.solicitacaoAdocao.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.solicitacaoAdocao.findUnique).not.toHaveBeenCalled();
    });

    it("estoque: mesma regra dos alertas, conta todos e lista os 5 mais críticos (menor proporção primeiro)", async () => {
        const item = (id: string, nomeItem: string, quantidadeAtual: number, quantidadeMinima: number) => ({
            id,
            nomeItem,
            quantidadeAtual,
            quantidadeMinima,
        });
        bancoCom({
            itensEmAlerta: [
                item("1", "Ração filhote", 9, 10), // 90%
                item("2", "Vermífugo", 0, 2), // 0%, saldo 0
                item("3", "Sabão", 1, 10), // 10%
                item("4", "Areia", 0, 20), // 0%, saldo 0 (empate com Vermífugo: ordem alfabética)
                item("5", "Coleira", 3, 6), // 50%
                item("6", "Shampoo", 2, 10), // 20%
                item("7", "Antipulgas", 4, 5), // 80%
            ],
        });

        const { estoque } = await service.resumo();

        expect(estoque.itensAbaixoDoMinimo).toBe(7);
        expect(estoque.itens.map((i) => i.nomeItem)).toEqual(["Areia", "Vermífugo", "Sabão", "Shampoo", "Coleira"]);
        expect(prismaMock.itemEstoque.findMany).toHaveBeenCalledWith({
            where: { quantidadeMinima: { gt: 0 }, quantidadeAtual: { lt: expect.anything() } },
            select: { id: true, nomeItem: true, quantidadeAtual: true, quantidadeMinima: true },
        });
    });

    it("doações: total do mês de Brasília e as 5 mais recentes, sem dados de quem registrou", async () => {
        const recentes = [{ id: "d1", quantidade: 10, doador: "Mercado Bom Preço", dataEntrada: new Date() }];
        bancoCom({ doacoesNoMes: 14, doacoesRecentes: recentes });

        const { doacoes } = await service.resumo();

        expect(doacoes).toEqual({ totalNoMes: 14, recentes });
        expect(prismaMock.doacao.count).toHaveBeenCalledWith({
            where: {
                dataEntrada: { gte: new Date("2026-10-01T03:00:00.000Z"), lt: new Date("2026-11-01T03:00:00.000Z") },
            },
        });
        const consulta = prismaMock.doacao.findMany.mock.calls[0]?.[0];
        expect(consulta).toMatchObject({ orderBy: { dataEntrada: "desc" }, take: 5 });
        // o usuário que registrou (CPF, e-mail) não entra
        expect(consulta?.select).not.toHaveProperty("usuario");
        expect(consulta?.select).not.toHaveProperty("usuarioId");
    });

    it("eventos: os 5 próximos a partir de hoje (dia de Brasília), com a data como AAAA-MM-DD", async () => {
        bancoCom({
            eventos: [{ id: "e1", titulo: "Feira de adoção", data: new Date("2026-10-25T00:00:00.000Z"), horarioInicio: "09:00" }],
        });

        const { eventos } = await service.resumo();

        expect(eventos.proximos).toEqual([{ id: "e1", titulo: "Feira de adoção", data: "2026-10-25", horarioInicio: "09:00" }]);
        expect(prismaMock.evento.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { data: { gte: new Date("2026-10-25T00:00:00.000Z") } },
                orderBy: [{ data: "asc" }, { horarioInicio: "asc" }],
                take: 5,
            }),
        );
    });

    it("virada de ano: 31/12 às 23h30 em Brasília conta dezembro como mês atual", async () => {
        // já é 01/01 em UTC (e em Tóquio, fuso da máquina dos testes)
        vi.setSystemTime(new Date("2026-01-01T02:30:00.000Z"));
        bancoCom({ adocoesPorInicioDoMes: { "2025-12-01T03:00:00.000Z": 5 } });

        const { adocoes } = await service.resumo();

        expect(adocoes.porMes.map((m) => m.mes)).toEqual(["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]);
        expect(adocoes.concluidasNoMes).toBe(5);
        expect(prismaMock.doacao.count).toHaveBeenCalledWith({
            where: {
                dataEntrada: { gte: new Date("2025-12-01T03:00:00.000Z"), lt: new Date("2026-01-01T03:00:00.000Z") },
            },
        });
        // próximos eventos a partir de 31/12 (dia de Brasília)
        expect(prismaMock.evento.findMany.mock.calls[0]?.[0]?.where).toEqual({
            data: { gte: new Date("2025-12-31T00:00:00.000Z") },
        });
    });

    it("todas as consultas começam juntas (em paralelo), sem esperar uma pela outra", async () => {
        bancoCom();
        // segura a primeira consulta: as outras precisam ser chamadas mesmo assim
        let liberar: (valor: never) => void = () => {};
        mockGroupBy(prismaMock.animal.groupBy).mockImplementationOnce((() => new Promise((resolve) => (liberar = resolve))) as never);

        const resultado = service.resumo();
        await Promise.resolve();

        expect(prismaMock.solicitacaoAdocao.groupBy).toHaveBeenCalled();
        expect(prismaMock.itemEstoque.findMany).toHaveBeenCalled();
        expect(prismaMock.doacao.findMany).toHaveBeenCalled();
        expect(prismaMock.evento.findMany).toHaveBeenCalled();

        liberar([] as never);
        await expect(resultado).resolves.toBeDefined();
    });
});
