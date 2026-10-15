import { z } from "zod";
import { Especie, Porte, StatusAnimal } from "@prisma/client";
import { MAX_TEXTO, paraAtualizacao, textoObrigatorio, textoOpcional } from "./comum";

// usuarioCadastro não é aceito do cliente: vem do token (req.usuario).
const animalSchema = z.strictObject({
    nome: textoObrigatorio(),
    especie: z.enum(Especie),
    raca: textoOpcional(),
    idade: z.int().min(0).max(40).nullable().optional(),
    porte: z.enum(Porte),
    status: z.enum(StatusAnimal).optional(),
    fotoUrl: z.url({ protocol: /^https?$/ }).max(MAX_TEXTO).nullable().optional(),
    descricao: textoOpcional(),
});

export const criarAnimalSchema = animalSchema;
export const atualizarAnimalSchema = paraAtualizacao(animalSchema);
