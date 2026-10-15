import { Router } from "express";
import { termoAdocaoController } from "../controller/termoAdocaoController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar } from "../middleware/validar";
import { criarTermoAdocaoSchema, atualizarTermoAdocaoSchema } from "../validators/termoAdocaoValidator";

const router = Router();
const controller = new termoAdocaoController();

// gerar o termo de adoção é uma decisão administrativa — só o admin pode criar
router.post("/", authMiddleware, somenteAdmin, validar(criarTermoAdocaoSchema), controller.create.bind(controller));
router.get("/", authMiddleware, controller.findAll.bind(controller));
router.get("/:id", authMiddleware, validar(), controller.findById.bind(controller));
router.put("/:id", authMiddleware, somenteAdmin, validar(atualizarTermoAdocaoSchema), controller.update.bind(controller));
router.delete("/:id", authMiddleware, somenteAdmin, validar(), controller.delete.bind(controller));

export default router;
