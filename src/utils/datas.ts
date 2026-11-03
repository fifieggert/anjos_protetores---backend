// Datas "só dia" (colunas @db.Date). O frontend envia o dia escolhido ao meio-dia local
// (ex.: 2026-10-21T15:00:00.000Z para Brasília); o dia vale no fuso do abrigo.
export const FUSO_ABRIGO = "America/Sao_Paulo";

// "en-CA" formata como AAAA-MM-DD.
const formatoDia = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_ABRIGO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

// Dia (AAAA-MM-DD) de um instante no fuso do abrigo.
export function diaNoFuso(instante: Date) {
    return formatoDia.format(instante);
}

export function hoje() {
    return diaNoFuso(new Date());
}

// AAAA-MM-DD -> Date à meia-noite UTC, que é como o Prisma grava e lê colunas @db.Date.
export function diaParaBanco(dia: string) {
    return new Date(`${dia}T00:00:00.000Z`);
}

// Date lida de uma coluna @db.Date (meia-noite UTC) -> AAAA-MM-DD. Devolver só o dia
// evita que o cliente converta a meia-noite UTC para o fuso local e mostre o dia anterior.
export function diaDoBanco(data: Date) {
    return data.toISOString().slice(0, 10);
}
