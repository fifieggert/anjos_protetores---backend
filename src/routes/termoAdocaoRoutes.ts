import { Router } from "express";
import { termoAdocaoController } from "../controller/termoAdocaoController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar } from "../middleware/validar";
import { criarTermoAdocaoSchema, atualizarTermoAdocaoSchema } from "../validators/termoAdocaoValidator";

const router = Router();
const controller = new termoAdocaoController();

// termos fazem parte do fluxo de adoção, que é da coordenação
router.use(authMiddleware, somenteAdmin);

router.post("/", validar(criarTermoAdocaoSchema), controller.create.bind(controller));
router.get("/", controller.findAll.bind(controller));
router.get("/:id", validar(), controller.findById.bind(controller));
// PDF com nome e telefone do interessado: só ADMIN (router.use acima)
router.get("/:id/pdf", validar(), controller.pdf.bind(controller));
router.put("/:id", validar(atualizarTermoAdocaoSchema), controller.update.bind(controller));
router.delete("/:id", validar(), controller.delete.bind(controller));

export default router;
