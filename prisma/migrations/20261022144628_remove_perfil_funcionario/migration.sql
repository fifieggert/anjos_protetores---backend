-- Remove o perfil FUNCIONARIO (era equivalente a VOLUNTARIO).
-- A ordem importa: primeiro converte os usuários, enquanto o valor ainda existe no enum;
-- só depois encolhe o enum. Ao contrário, o MySQL recusa o ALTER (modo estrito) ou
-- grava '' nas linhas com o valor removido.
UPDATE `Usuario` SET `perfil` = 'VOLUNTARIO' WHERE `perfil` = 'FUNCIONARIO';

-- AlterTable
ALTER TABLE `Usuario` MODIFY `perfil` ENUM('ADMIN', 'VOLUNTARIO') NOT NULL;
