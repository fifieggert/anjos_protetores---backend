import { Router } from "express";
import { PerfilUsuario } from "@prisma/client";
import { imagemController } from "../controller/imagemController";
import { authMiddleware, permitirPerfis } from "../middleware/authMiddleware";
import { limiteLeituraImagens, limiteUploads } from "../middleware/limiteRequisicoes";
import { armazenamentoDisponivel, receberImagem } from "../middleware/uploadImagem";

const router = Router();
const controller = new imagemController();

// Upload: equipe do abrigo (quem cadastra animais e eventos). A ordem importa: o corpo
// (até 10 MB) só é lido depois do token, do perfil, do limite e do armazenamento.
router.post(
    "/",
    authMiddleware,
    permitirPerfis(PerfilUsuario.ADMIN, PerfilUsuario.VOLUNTARIO),
    limiteUploads,
    armazenamentoDisponivel,
    receberImagem,
    controller.upload.bind(controller),
);

// Leitura pública das imagens (o nome é validado no imagemService), com limite folgado por IP.
router.get("/:arquivo", limiteLeituraImagens, controller.ler.bind(controller));

export default router;
