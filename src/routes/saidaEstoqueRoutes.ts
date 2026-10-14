import { Router } from "express";
import { saidaEstoqueController } from "../controller/saidaEstoqueController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";

const router = Router();
const controller = new saidaEstoqueController();

// saídas de estoque são registradas e consultadas só pela coordenação
router.use(authMiddleware, somenteAdmin);

router.post("/", controller.create.bind(controller));
router.get("/", controller.findAll.bind(controller));
router.get("/:id", controller.findById.bind(controller));
router.put("/:id", controller.update.bind(controller));
router.delete("/:id", controller.delete.bind(controller));

export default router;
