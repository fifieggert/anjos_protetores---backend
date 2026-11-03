-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senhaHash` VARCHAR(191) NOT NULL,
    `perfil` ENUM('ADMIN', 'FUNCIONARIO', 'VOLUNTARIO') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_cpf_key`(`cpf`),
    UNIQUE INDEX `Usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Animal` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioCadastroId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `especie` ENUM('CACHORRO', 'GATO', 'OUTRO') NOT NULL,
    `raca` VARCHAR(191) NULL,
    `idade` INTEGER NULL,
    `porte` ENUM('PEQUENO', 'MEDIO', 'GRANDE') NOT NULL,
    `status` ENUM('DISPONIVEL', 'EM_TRATAMENTO', 'ADOTADO') NOT NULL DEFAULT 'DISPONIVEL',
    `fotoUrl` VARCHAR(191) NULL,
    `descricao` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemEstoque` (
    `id` VARCHAR(191) NOT NULL,
    `nomeItem` VARCHAR(191) NOT NULL,
    `categoria` ENUM('RACAO', 'MEDICAMENTO', 'HIGIENE', 'LIMPEZA', 'ACESSORIO') NOT NULL,
    `quantidadeAtual` INTEGER NOT NULL,
    `quantidadeMinima` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Doacao` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `doador` VARCHAR(191) NOT NULL,
    `dataEntrada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SaidaEstoque` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `finalidade` VARCHAR(191) NOT NULL,
    `dataSaida` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SolicitacaoAdocao` (
    `id` VARCHAR(191) NOT NULL,
    `animalId` VARCHAR(191) NOT NULL,
    `nomeInteressado` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDENTE', 'APROVADA', 'RECUSADA') NOT NULL DEFAULT 'PENDENTE',
    `justificativa` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TermoAdocao` (
    `id` VARCHAR(191) NOT NULL,
    `solicitacaoId` VARCHAR(191) NOT NULL,
    `geradoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `urlDocumento` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `TermoAdocao_solicitacaoId_key`(`solicitacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Animal` ADD CONSTRAINT `Animal_usuarioCadastroId_fkey` FOREIGN KEY (`usuarioCadastroId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Doacao` ADD CONSTRAINT `Doacao_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `ItemEstoque`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Doacao` ADD CONSTRAINT `Doacao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaidaEstoque` ADD CONSTRAINT `SaidaEstoque_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `ItemEstoque`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaidaEstoque` ADD CONSTRAINT `SaidaEstoque_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SolicitacaoAdocao` ADD CONSTRAINT `SolicitacaoAdocao_animalId_fkey` FOREIGN KEY (`animalId`) REFERENCES `Animal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TermoAdocao` ADD CONSTRAINT `TermoAdocao_solicitacaoId_fkey` FOREIGN KEY (`solicitacaoId`) REFERENCES `SolicitacaoAdocao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
