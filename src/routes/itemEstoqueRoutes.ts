import { Router } from "express";
import { itemEstoqueController } from "../controller/itemEstoqueController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";

const router = Router();
const controller = new itemEstoqueController();

// todos consultam o estoque; cadastrar e alterar itens é da coordenação
router.post("/", authMiddleware, somenteAdmin, controller.create.bind(controller));
router.get("/", authMiddleware, controller.findAll.bind(controller));
router.get("/:id", authMiddleware, controller.findById.bind(controller));
router.put("/:id", authMiddleware, somenteAdmin, controller.update.bind(controller));
router.delete("/:id", authMiddleware, somenteAdmin, controller.delete.bind(controller));

export default router;
