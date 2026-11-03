// Meses no fuso de Brasília, usados nos números do painel (ex.: "adoções concluídas no mês").
//
// Brasília é UTC-3 o ano todo (o Brasil não tem horário de verão desde 2019), então o
// deslocamento é fixo. As contas não dependem do fuso da máquina (os testes rodam em Tóquio).

const DESLOCAMENTO_BRASILIA_MS = 3 * 60 * 60 * 1000;

export interface Mes {
    // "AAAA-MM", como sai na resposta da API
    mes: string;
    // primeiro instante do mês em Brasília (dia 1, 00:00 em Brasília = 03:00 UTC)
    inicio: Date;
    // primeiro instante do mês seguinte (fim exclusivo: use "menor que")
    fim: Date;
}

// Início do mês (em Brasília) como instante. "mes" começa em 0 (janeiro) e pode passar de
// 11 ou ficar negativo: o Date.UTC ajusta o ano sozinho (ex.: mês -1 = dezembro anterior).
function inicioDoMes(ano: number, mes: number) {
    return new Date(Date.UTC(ano, mes, 1) + DESLOCAMENTO_BRASILIA_MS);
}

function rotulo(inicio: Date) {
    // volta para o "relógio de Brasília" para ler ano e mês
    return new Date(inicio.getTime() - DESLOCAMENTO_BRASILIA_MS).toISOString().slice(0, 7);
}

// Os últimos "quantidade" meses até o mês de "agora" (inclusive), do mais antigo ao atual.
export function ultimosMeses(agora: Date, quantidade: number): Mes[] {
    const relogioBrasilia = new Date(agora.getTime() - DESLOCAMENTO_BRASILIA_MS);
    const ano = relogioBrasilia.getUTCFullYear();
    const mesDeAgora = relogioBrasilia.getUTCMonth();

    const meses: Mes[] = [];
    for (let atras = quantidade - 1; atras >= 0; atras--) {
        const inicio = inicioDoMes(ano, mesDeAgora - atras);
        meses.push({ mes: rotulo(inicio), inicio, fim: inicioDoMes(ano, mesDeAgora - atras + 1) });
    }
    return meses;
}

// O mês de "agora" em Brasília.
export function mesAtual(agora: Date): Mes {
    return ultimosMeses(agora, 1)[0] as Mes;
}
