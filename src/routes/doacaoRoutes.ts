import { Router } from "express";
import { doacaoController } from "../controller/doacaoController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar } from "../middleware/validar";
import { criarDoacaoSchema, atualizarDoacaoSchema } from "../validators/doacaoValidator";

const router = Router();
const controller = new doacaoController();

// qualquer membro da equipe registra doações recebidas; corrigir ou excluir é da coordenação
router.post("/", authMiddleware, validar(criarDoacaoSchema), controller.create.bind(controller));
router.get("/", authMiddleware, controller.findAll.bind(controller));
router.get("/:id", authMiddleware, validar(), controller.findById.bind(controller));
router.put("/:id", authMiddleware, somenteAdmin, validar(atualizarDoacaoSchema), controller.update.bind(controller));
router.delete("/:id", authMiddleware, somenteAdmin, validar(), controller.delete.bind(controller));

export default router;
