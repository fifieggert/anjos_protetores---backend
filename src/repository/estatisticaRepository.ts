import prisma from "../config/prisma";
import { StatusAnimal } from "@prisma/client";

export class estatisticaRepository {
    // Números do site público: só totais, nenhum dado pessoal.
    async totaisPublicos() {
        const [animaisAdotados, animaisDisponiveis, doacoesRecebidas] = await Promise.all([
            prisma.animal.count({ where: { status: StatusAnimal.ADOTADO } }),
            prisma.animal.count({ where: { status: StatusAnimal.DISPONIVEL } }),
            prisma.doacao.count(),
        ]);
        return { animaisAdotados, animaisDisponiveis, doacoesRecebidas };
    }
}
