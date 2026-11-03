/*
  Warnings:

  - You are about to drop the column `email` on the `SolicitacaoAdocao` table. All the data in the column will be lost.
  - You are about to drop the column `justificativa` on the `SolicitacaoAdocao` table. All the data in the column will be lost.
  - You are about to drop the column `nomeInteressado` on the `SolicitacaoAdocao` table. All the data in the column will be lost.
  - You are about to alter the column `telefone` on the `SolicitacaoAdocao` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(11)`.
  - You are about to drop the column `urlDocumento` on the `TermoAdocao` table. All the data in the column will be lost.
  - Added the required column `atualizadoEm` to the `SolicitacaoAdocao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nome` to the `SolicitacaoAdocao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `animalId` to the `TermoAdocao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `geradoPorId` to the `TermoAdocao` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `TermoAdocao` DROP FOREIGN KEY `TermoAdocao_solicitacaoId_fkey`;

-- DropIndex
DROP INDEX `TermoAdocao_solicitacaoId_key` ON `TermoAdocao`;

-- AlterTable
ALTER TABLE `Animal` ADD COLUMN `castrado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `dataCastracao` DATETIME(3) NULL,
    ADD COLUMN `dataRevacinacao` DATETIME(3) NULL,
    ADD COLUMN `dosesVacina` INTEGER NULL,
    ADD COLUMN `sexo` ENUM('MACHO', 'FEMEA') NULL,
    ADD COLUMN `vacinado` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `status` ENUM('DISPONIVEL', 'EM_TRATAMENTO', 'EM_ESPERA', 'ADOTADO') NOT NULL DEFAULT 'DISPONIVEL';

-- AlterTable
ALTER TABLE `SolicitacaoAdocao` DROP COLUMN `email`,
    DROP COLUMN `justificativa`,
    DROP COLUMN `nomeInteressado`,
    ADD COLUMN `atualizadoEm` DATETIME(3) NOT NULL,
    ADD COLUMN `nome` VARCHAR(100) NOT NULL,
    MODIFY `telefone` VARCHAR(11) NOT NULL,
    MODIFY `status` ENUM('PENDENTE', 'EM_CONTATO', 'APROVADA', 'RECUSADA') NOT NULL DEFAULT 'PENDENTE';

-- AlterTable
ALTER TABLE `TermoAdocao` DROP COLUMN `urlDocumento`,
    ADD COLUMN `animalId` VARCHAR(191) NOT NULL,
    ADD COLUMN `assinado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `assinadoEm` DATETIME(3) NULL,
    ADD COLUMN `geradoPorId` VARCHAR(191) NOT NULL,
    MODIFY `solicitacaoId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `SolicitacaoAdocao_telefone_status_idx` ON `SolicitacaoAdocao`(`telefone`, `status`);

-- CreateIndex
CREATE INDEX `SolicitacaoAdocao_animalId_status_idx` ON `SolicitacaoAdocao`(`animalId`, `status`);

-- AddForeignKey
ALTER TABLE `TermoAdocao` ADD CONSTRAINT `TermoAdocao_animalId_fkey` FOREIGN KEY (`animalId`) REFERENCES `Animal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TermoAdocao` ADD CONSTRAINT `TermoAdocao_solicitacaoId_fkey` FOREIGN KEY (`solicitacaoId`) REFERENCES `SolicitacaoAdocao`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TermoAdocao` ADD CONSTRAINT `TermoAdocao_geradoPorId_fkey` FOREIGN KEY (`geradoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
