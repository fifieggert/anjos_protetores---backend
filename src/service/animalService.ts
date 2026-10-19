import { Prisma, StatusAnimal } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { animalSelect } from "../repository/animalRepository";
import { emTransacaoSerializavel } from "./transacao";

// Status que só o fluxo de adoção define (ver adocaoService).
const STATUS_DA_ADOCAO: StatusAnimal[] = [StatusAnimal.EM_ESPERA, StatusAnimal.ADOTADO];

export interface AtualizacaoAnimal extends Prisma.AnimalUpdateInput {
    status?: StatusAnimal;
    castrado?: boolean;
    dataCastracao?: Date | null;
    vacinado?: boolean;
    dosesVacina?: number | null;
    dataRevacinacao?: Date | null;
}

export class animalService {
    // Edição de um animal. Regras:
    // - status: o PUT só leva a DISPONIVEL ou EM_TRATAMENTO, e não mexe no status de um
    //   animal EM_ESPERA (ele está reservado por um interesse; use concluir/cancelar).
    //   Enviar o mesmo status atual é aceito e ignorado (o formulário sempre envia o campo).
    //   ADOTADO -> DISPONIVEL/EM_TRATAMENTO é permitido (devolução): não há interesse em
    //   andamento para um animal adotado.
    // - castração/vacina: a coerência é conferida com os valores já gravados. Desmarcar
    //   castrado ou vacinado limpa as datas e doses correspondentes.
    atualizar(id: string, dados: AtualizacaoAnimal) {
        return emTransacaoSerializavel(async (tx) => {
            const atual = await tx.animal.findUnique({
                where: { id },
                select: { status: true, castrado: true, vacinado: true },
            });
            if (!atual) throw new AppError(404, "Animal não encontrado.");

            const alteracao: AtualizacaoAnimal = { ...dados };
            const campos: Record<string, string> = {};

            if (alteracao.status === atual.status) {
                delete alteracao.status;
            } else if (alteracao.status !== undefined) {
                if (STATUS_DA_ADOCAO.includes(alteracao.status)) {
                    campos["status"] = "Este status só é definido pelo fluxo de adoção (interesse, concluir ou cancelar).";
                } else if (atual.status === StatusAnimal.EM_ESPERA) {
                    throw new AppError(
                        409,
                        "Este animal está reservado por um interesse de adoção. Conclua ou cancele a solicitação para mudar o status.",
                    );
                }
            }

            const castrado = alteracao.castrado ?? atual.castrado;
            if (!castrado) {
                if (alteracao.dataCastracao) campos["dataCastracao"] = "Deixe vazio quando o animal não é castrado.";
                else if (alteracao.castrado === false) alteracao.dataCastracao = null;
            }

            const vacinado = alteracao.vacinado ?? atual.vacinado;
            if (!vacinado) {
                if (alteracao.dosesVacina != null) campos["dosesVacina"] = "Deixe vazio quando o animal não é vacinado.";
                if (alteracao.dataRevacinacao) campos["dataRevacinacao"] = "Deixe vazio quando o animal não é vacinado.";
                if (alteracao.vacinado === false) {
                    alteracao.dosesVacina ??= null;
                    alteracao.dataRevacinacao ??= null;
                }
            }

            if (Object.keys(campos).length > 0) throw new AppError(400, "Dados inválidos.", campos);

            return tx.animal.update({ where: { id }, data: alteracao, select: animalSelect });
        });
    }
}
