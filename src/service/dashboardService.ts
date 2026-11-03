import { Especie, StatusAnimal, StatusSolicitacao } from "@prisma/client";
import { dashboardRepository } from "../repository/dashboardRepository";
import { eventoRepository } from "../repository/eventoRepository";
import { diaParaBanco, hoje } from "../utils/datas";
import { mesAtual, ultimosMeses } from "../utils/meses";

// Tamanho das listas do painel e quantos meses aparecem no gráfico de adoções.
export const LIMITE_LISTAS = 5;
export const MESES_DO_GRAFICO = 6;

const repository = new dashboardRepository();
const eventos = new eventoRepository();

// Transforma o resultado de um groupBy em { VALOR: total }, com 0 para os valores do enum
// que não apareceram (o banco não devolve linha para o que tem contagem zero).
function contarPorValor<T extends string, G extends { _count: { _all: number } }>(
    valores: readonly T[],
    grupos: G[],
    chave: (grupo: G) => T,
): Record<T, number> {
    const totais = Object.fromEntries(valores.map((valor) => [valor, 0])) as Record<T, number>;
    for (const grupo of grupos) {
        // "_count._all" é o nome que o Prisma dá à contagem no groupBy (não dá para mudar)
        // oxlint-disable-next-line no-underscore-dangle
        totais[chave(grupo)] = grupo._count._all;
    }
    return totais;
}

// Quanto menor a proporção atual/mínimo, mais crítico. Empate: o de menor saldo e,
// depois, ordem alfabética (para o resultado ser sempre o mesmo).
function maisCriticoPrimeiro(
    a: { nomeItem: string; quantidadeAtual: number; quantidadeMinima: number },
    b: { nomeItem: string; quantidadeAtual: number; quantidadeMinima: number },
) {
    return (
        a.quantidadeAtual / a.quantidadeMinima - b.quantidadeAtual / b.quantidadeMinima ||
        a.quantidadeAtual - b.quantidadeAtual ||
        a.nomeItem.localeCompare(b.nomeItem, "pt-BR")
    );
}

export class dashboardService {
    // Monta o painel. Todas as consultas rodam em paralelo (Promise.all).
    async resumo(agora: Date = new Date()) {
        const meses = ultimosMeses(agora, MESES_DO_GRAFICO);
        const esteMes = mesAtual(agora);

        const [
            animaisPorStatus,
            animaisPorEspecie,
            solicitacoesPorStatus,
            adocoesPorMes,
            itensEmAlerta,
            doacoesNoMes,
            doacoesRecentes,
            proximosEventos,
        ] = await Promise.all([
            repository.animaisPorStatus(),
            repository.animaisPorEspecie(),
            repository.solicitacoesPorStatus(),
            // uma contagem por mês (6 consultas pequenas, também em paralelo)
            Promise.all(meses.map((mes) => repository.adocoesConcluidasEntre(mes))),
            repository.itensAbaixoDoMinimo(),
            repository.doacoesEntre(esteMes),
            repository.doacoesRecentes(LIMITE_LISTAS),
            // mesma regra do site público e de GET /eventos?periodo=proximos: de hoje em diante
            eventos.findPublicos(diaParaBanco(hoje()), LIMITE_LISTAS),
        ]);

        const porStatus = contarPorValor(Object.values(StatusAnimal), animaisPorStatus, (grupo) => grupo.status);
        const porEspecie = contarPorValor(Object.values(Especie), animaisPorEspecie, (grupo) => grupo.especie);
        const solicitacoes = contarPorValor(
            Object.values(StatusSolicitacao),
            solicitacoesPorStatus,
            (grupo) => grupo.status,
        );

        const porMes = meses.map(({ mes }, i) => ({ mes, total: adocoesPorMes[i] ?? 0 }));

        return {
            animais: {
                total: Object.values<number>(porStatus).reduce((soma, n) => soma + n, 0),
                porStatus,
                porEspecie: Object.values(Especie).map((especie) => ({ especie, total: porEspecie[especie] })),
            },
            adocoes: {
                pendentes: solicitacoes.PENDENTE,
                emContato: solicitacoes.EM_CONTATO,
                // o último mês do gráfico é o mês atual
                concluidasNoMes: porMes.at(-1)?.total ?? 0,
                concluidasTotal: solicitacoes.APROVADA,
                porMes,
            },
            estoque: {
                itensAbaixoDoMinimo: itensEmAlerta.length,
                itens: [...itensEmAlerta].sort(maisCriticoPrimeiro).slice(0, LIMITE_LISTAS),
            },
            doacoes: {
                totalNoMes: doacoesNoMes,
                recentes: doacoesRecentes,
            },
            eventos: {
                proximos: proximosEventos,
            },
        };
    }
}
