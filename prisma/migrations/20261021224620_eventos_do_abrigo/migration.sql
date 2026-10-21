-- CreateTable
CREATE TABLE `Evento` (
    `id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(100) NOT NULL,
    `descricao` VARCHAR(1000) NULL,
    `data` DATE NOT NULL,
    `horarioInicio` VARCHAR(5) NOT NULL,
    `horarioFim` VARCHAR(5) NULL,
    `local` VARCHAR(191) NOT NULL,
    `imagemUrl` VARCHAR(500) NULL,
    `criadoPorId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `Evento_data_horarioInicio_idx`(`data`, `horarioInicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Evento` ADD CONSTRAINT `Evento_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
