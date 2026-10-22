import { AppError } from "../utils/AppError";
import { termoAdocaoSelect } from "../repository/termoAdocaoRepository";
import { emTransacaoSerializavel } from "./transacao";

export interface NovaGeracaoTermo {
    animalId: string;
    solicitacaoId?: string;
    geradoPorId: string;
}

export class termoAdocaoService {
    // Registra a geração do termo de forma idempotente: se já existe um termo NÃO assinado
    // para o mesmo animal e a mesma solicitação (ou sem solicitação), devolve esse termo
    // em vez de criar outro. A transação serializável impede que dois cliques simultâneos
    // criem dois termos.
    registrarGeracao({ animalId, solicitacaoId, geradoPorId }: NovaGeracaoTermo) {
        return emTransacaoSerializavel(async (tx) => {
            const animal = await tx.animal.findUnique({ where: { id: animalId }, select: { id: true } });
            if (!animal) throw new AppError(404, "Animal não encontrado.");

            if (solicitacaoId) {
                const solicitacao = await tx.solicitacaoAdocao.findUnique({
                    where: { id: solicitacaoId },
                    select: { animalId: true },
                });
                if (!solicitacao) throw new AppError(404, "Solicitação de adoção não encontrada.");
                if (solicitacao.animalId !== animalId) {
                    throw new AppError(409, "A solicitação informada é de outro animal.");
                }
            }

            const existente = await tx.termoAdocao.findFirst({
                where: { animalId, solicitacaoId: solicitacaoId ?? null, assinado: false },
                select: termoAdocaoSelect,
                orderBy: { geradoEm: "desc" },
            });
            if (existente) return { termo: existente, criado: false };

            const termo = await tx.termoAdocao.create({
                data: { animalId, geradoPorId, ...(solicitacaoId ? { solicitacaoId } : {}) },
                select: termoAdocaoSelect,
            });
            return { termo, criado: true };
        });
    }
}
