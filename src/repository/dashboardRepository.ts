import prisma from "../config/prisma";
import { Prisma, StatusSolicitacao } from "@prisma/client";

// Consultas do painel da coordenação. Quase tudo é contagem (count/groupBy) feita no banco:
// nenhuma tabela é carregada inteira na memória. Nenhuma consulta devolve nome ou telefone
// de interessados em adoção.

// Doação no painel: o item e quem doou. Sem o usuário que registrou (CPF e e-mail ficam de fora).
const doacaoRecenteSelect = {
    id: true,
    quantidade: true,
    doador: true,
    dataEntrada: true,
    item: { select: { id: true, nomeItem: true, categoria: true } },
} satisfies Prisma.DoacaoSelect;

export interface Periodo {
    inicio: Date;
    fim: Date;
}

export class dashboardRepository {
    animaisPorStatus() {
        return prisma.animal.groupBy({ by: ["status"], _count: { _all: true } });
    }

    animaisPorEspecie() {
        return prisma.animal.groupBy({ by: ["especie"], _count: { _all: true } });
    }

    solicitacoesPorStatus() {
        return prisma.solicitacaoAdocao.groupBy({ by: ["status"], _count: { _all: true } });
    }

    // Adoção concluída = solicitação APROVADA. Depois de aprovada ela não muda mais, então o
    // atualizadoEm é o momento da conclusão.
    adocoesConcluidasEntre({ inicio, fim }: Periodo) {
        return prisma.solicitacaoAdocao.count({
            where: { status: StatusSolicitacao.APROVADA, atualizadoEm: { gte: inicio, lt: fim } },
        });
    }

    // Mesma regra do GET /itens-estoque/alertas: mínimo maior que 0 e atual abaixo dele.
    // Só os itens em alerta e só os campos do painel.
    itensAbaixoDoMinimo() {
        return prisma.itemEstoque.findMany({
            where: {
                quantidadeMinima: { gt: 0 },
                quantidadeAtual: { lt: prisma.itemEstoque.fields.quantidadeMinima },
            },
            select: { id: true, nomeItem: true, quantidadeAtual: true, quantidadeMinima: true },
        });
    }

    doacoesEntre({ inicio, fim }: Periodo) {
        return prisma.doacao.count({ where: { dataEntrada: { gte: inicio, lt: fim } } });
    }

    doacoesRecentes(limite: number) {
        return prisma.doacao.findMany({
            select: doacaoRecenteSelect,
            orderBy: { dataEntrada: "desc" },
            take: limite,
        });
    }
}
