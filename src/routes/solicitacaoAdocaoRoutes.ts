import { Router } from "express";
import { solicitacaoAdocaoController } from "../controller/solicitacaoAdocaoController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";

const router = Router();
const controller = new solicitacaoAdocaoController();

// aberta ao público: é o formulário de interesse em adotar, preenchido por quem ainda não tem conta no sistema
router.post("/", controller.create.bind(controller));
router.get("/", authMiddleware, controller.findAll.bind(controller));
router.get("/:id", authMiddleware, controller.findById.bind(controller));
// aceitar/recusar uma solicitação (mudar o status) é feito por aqui — só o admin pode decidir
router.put("/:id", authMiddleware, somenteAdmin, controller.update.bind(controller));
router.delete("/:id", authMiddleware, somenteAdmin, controller.delete.bind(controller));

export default router;