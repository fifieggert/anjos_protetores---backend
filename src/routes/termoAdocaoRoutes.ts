import { Router } from "express";
import { termoAdocaoController } from "../controller/termoAdocaoController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";

const router = Router();
const controller = new termoAdocaoController();

// gerar o termo de adoção é uma decisão administrativa — só o admin pode criar
router.post("/", authMiddleware, somenteAdmin, controller.create.bind(controller));
router.get("/", authMiddleware, controller.findAll.bind(controller));
router.get("/:id", authMiddleware, controller.findById.bind(controller));
router.put("/:id", authMiddleware, somenteAdmin, controller.update.bind(controller));
router.delete("/:id", authMiddleware, somenteAdmin, controller.delete.bind(controller));

export default router;
