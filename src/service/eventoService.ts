import prisma from "../config/prisma";
import type { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { comDia, eventoSelect } from "../repository/eventoRepository";
import { diaParaBanco } from "../utils/datas";
import { MENSAGEM_HORARIO_FIM, fimDepoisDoInicio } from "../validators/eventoValidator";

// Corpo já validado (eventoValidator). A data chega como AAAA-MM-DD.
export interface DadosEvento extends Omit<Prisma.EventoCreateInput, "data" | "criadoPor"> {
    data: string;
}

export interface AtualizacaoEvento extends Omit<Prisma.EventoUpdateInput, "data" | "horarioInicio" | "horarioFim"> {
    data?: string;
    horarioInicio?: string;
    horarioFim?: string | null;
}

export class eventoService {
    async criar(dados: DadosEvento, criadoPorId: string) {
        const evento = await prisma.evento.create({
            data: { ...dados, data: diaParaBanco(dados.data), criadoPor: { connect: { id: criadoPorId } } },
            select: eventoSelect,
        });
        return comDia(evento);
    }

    // Quando só um dos horários vem no corpo, o término é conferido com o que já está gravado.
    async atualizar(id: string, dados: AtualizacaoEvento) {
        const atual = await prisma.evento.findUnique({
            where: { id },
            select: { horarioInicio: true, horarioFim: true },
        });
        if (!atual) throw new AppError(404, "Evento não encontrado.");

        const inicio = dados.horarioInicio ?? atual.horarioInicio;
        const fim = dados.horarioFim === undefined ? atual.horarioFim : dados.horarioFim;
        if (!fimDepoisDoInicio(inicio, fim)) {
            throw new AppError(400, "Dados inválidos.", { horarioFim: MENSAGEM_HORARIO_FIM });
        }

        const { data, ...resto } = dados;
        const evento = await prisma.evento.update({
            where: { id },
            data: { ...resto, ...(data !== undefined ? { data: diaParaBanco(data) } : {}) },
            select: eventoSelect,
        });
        return comDia(evento);
    }
}
