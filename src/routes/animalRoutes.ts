import { Router } from "express";
import { animalController } from "../controller/animalController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar } from "../middleware/validar";
import { criarAnimalSchema, atualizarAnimalSchema } from "../validators/animalValidator";

const router = Router();
const controller = new animalController();

// listagem completa (todos os status) é interna; o site público usa GET /api/publico/animais
router.post("/", authMiddleware, validar(criarAnimalSchema), controller.create.bind(controller));
router.get("/", authMiddleware, controller.findAll.bind(controller));
router.get("/:id", authMiddleware, validar(), controller.findById.bind(controller));
router.put("/:id", authMiddleware, validar(atualizarAnimalSchema), controller.update.bind(controller));
router.delete("/:id", authMiddleware, somenteAdmin, validar(), controller.delete.bind(controller));

export default router;
