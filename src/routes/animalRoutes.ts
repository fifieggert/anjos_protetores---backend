import { Router } from "express";
import { animalController } from "../controller/animalController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";

const router = Router();
const controller = new animalController();

// listagem completa (todos os status) é interna; o site público usa GET /api/publico/animais
router.post("/", authMiddleware, controller.create.bind(controller));
router.get("/", authMiddleware, controller.findAll.bind(controller));
router.get("/:id", authMiddleware, controller.findById.bind(controller));
router.put("/:id", authMiddleware, controller.update.bind(controller));
router.delete("/:id", authMiddleware, somenteAdmin, controller.delete.bind(controller));

export default router;
