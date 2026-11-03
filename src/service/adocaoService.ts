import { Prisma, StatusAnimal, StatusSolicitacao } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { solicitacaoAdocaoSelect } from "../repository/solicitacaoAdocaoRepository";
import { emTransacaoSerializavel } from "./transacao";

// Interesses que ainda reservam o animal.
export const STATUS_EM_ANDAMENTO: StatusSolicitacao[] = [StatusSolicitacao.PENDENTE, StatusSolicitacao.EM_CONTATO];

const SOLICITACAO_NAO_ENCONTRADA = "Solicitação de adoção não encontrada.";
const SOLICITACAO_ENCERRADA = "Esta solicitação não está mais em andamento.";
const ANIMAL_NAO_RESERVADO = "O animal desta solicitação não está em espera por ela.";

export interface NovoInteresse {
    animalId: string;
    nome: string;
    telefone: string;
}

async function buscarSolicitacao(tx: Prisma.TransactionClient, id: string) {
    const solicitacao = await tx.solicitacaoAdocao.findUnique({
        where: { id },
        select: { id: true, animalId: true, status: true },
    });
    if (!solicitacao) throw new AppError(404, SOLICITACAO_NAO_ENCONTRADA);
    return solicitacao;
}

// Encerra uma solicitação em andamento e move o animal reservado (EM_ESPERA) para o
// status final. As duas atualizações são condicionais: se outra operação mudou a
// solicitação ou o animal antes, nada é gravado e a resposta é 409.
function encerrar(id: string, statusSolicitacao: StatusSolicitacao, statusAnimal: StatusAnimal) {
    return emTransacaoSerializavel(async (tx) => {
        const solicitacao = await buscarSolicitacao(tx, id);

        const encerrada = await tx.solicitacaoAdocao.updateMany({
            where: { id, status: { in: STATUS_EM_ANDAMENTO } },
            data: { status: statusSolicitacao },
        });
        if (encerrada.count === 0) throw new AppError(409, SOLICITACAO_ENCERRADA);

        const animal = await tx.animal.updateMany({
            where: { id: solicitacao.animalId, status: StatusAnimal.EM_ESPERA },
            data: { status: statusAnimal },
        });
        if (animal.count === 0) throw new AppError(409, ANIMAL_NAO_RESERVADO);

        return tx.solicitacaoAdocao.findUniqueOrThrow({ where: { id }, select: solicitacaoAdocaoSelect });
    });
}

// Fluxo de adoção: o interesse público reserva o animal (EM_ESPERA) e a coordenação
// conclui (ADOTADO) ou cancela (volta a DISPONIVEL). O status do animal nunca vira
// EM_ESPERA ou ADOTADO por outro caminho (ver animalService).
export class adocaoService {
    registrarInteresse(dados: NovoInteresse) {
        return emTransacaoSerializavel(async (tx) => {
            const interesseDoTelefone = await tx.solicitacaoAdocao.findFirst({
                where: { telefone: dados.telefone, status: { in: STATUS_EM_ANDAMENTO } },
                select: { id: true },
            });
            if (interesseDoTelefone) {
                throw new AppError(409, "Você já tem um interesse em andamento. Aguarde o contato do abrigo.");
            }

            // Reserva atômica: só um interesse consegue tirar o animal de DISPONIVEL.
            const reserva = await tx.animal.updateMany({
                where: { id: dados.animalId, status: StatusAnimal.DISPONIVEL },
                data: { status: StatusAnimal.EM_ESPERA },
            });
            if (reserva.count === 0) {
                const animal = await tx.animal.findUnique({ where: { id: dados.animalId }, select: { id: true } });
                if (!animal) throw new AppError(404, "Animal não encontrado.");
                throw new AppError(409, "Este animal já tem alguém interessado no momento.");
            }

            await tx.solicitacaoAdocao.create({ data: dados, select: { id: true } });
        });
    }

    // Única mudança de status livre: PENDENTE -> EM_CONTATO.
    marcarEmContato(id: string) {
        return emTransacaoSerializavel(async (tx) => {
            const { count } = await tx.solicitacaoAdocao.updateMany({
                where: { id, status: StatusSolicitacao.PENDENTE },
                data: { status: StatusSolicitacao.EM_CONTATO },
            });
            if (count === 0) {
                await buscarSolicitacao(tx, id);
                throw new AppError(409, "Só é possível marcar como em contato uma solicitação pendente.");
            }
            return tx.solicitacaoAdocao.findUniqueOrThrow({ where: { id }, select: solicitacaoAdocaoSelect });
        });
    }

    concluir(id: string) {
        return encerrar(id, StatusSolicitacao.APROVADA, StatusAnimal.ADOTADO);
    }

    // "Não deu certo": o animal volta para a página pública.
    cancelar(id: string) {
        return encerrar(id, StatusSolicitacao.RECUSADA, StatusAnimal.DISPONIVEL);
    }

    // Direito de exclusão: apaga nome e telefone. Se o interesse ainda reservava o
    // animal, ele volta a DISPONIVEL. Termos já gerados ficam, sem o vínculo.
    excluir(id: string) {
        return emTransacaoSerializavel(async (tx) => {
            const solicitacao = await buscarSolicitacao(tx, id);

            if (STATUS_EM_ANDAMENTO.includes(solicitacao.status)) {
                await tx.animal.updateMany({
                    where: { id: solicitacao.animalId, status: StatusAnimal.EM_ESPERA },
                    data: { status: StatusAnimal.DISPONIVEL },
                });
            }

            await tx.solicitacaoAdocao.delete({ where: { id } });
        });
    }
}
