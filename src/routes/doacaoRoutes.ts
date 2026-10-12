import { Router } from "express";
import { doacaoController } from "../controller/doacaoController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";

const router = Router();
const controller = new doacaoController();

// qualquer membro da equipe registra doações recebidas; corrigir ou excluir é da coordenação
router.post("/", authMiddleware, controller.create.bind(controller));
router.get("/", authMiddleware, controller.findAll.bind(controller));
router.get("/:id", authMiddleware, controller.findById.bind(controller));
router.put("/:id", authMiddleware, somenteAdmin, controller.update.bind(controller));
router.delete("/:id", authMiddleware, somenteAdmin, controller.delete.bind(controller));

export default router;
