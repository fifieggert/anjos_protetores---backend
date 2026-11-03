import { Router } from "express";
import { itemEstoqueController } from "../controller/itemEstoqueController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar } from "../middleware/validar";
import { criarItemEstoqueSchema, atualizarItemEstoqueSchema } from "../validators/itemEstoqueValidator";

const router = Router();
const controller = new itemEstoqueController();

// todos consultam o estoque; cadastrar e alterar itens é da coordenação
router.post("/", authMiddleware, somenteAdmin, validar(criarItemEstoqueSchema), controller.create.bind(controller));
router.get("/", authMiddleware, controller.findAll.bind(controller));
// antes de /:id para "alertas" não ser lido como id
router.get("/alertas", authMiddleware, controller.findAlertas.bind(controller));
router.get("/:id", authMiddleware, validar(), controller.findById.bind(controller));
router.put("/:id", authMiddleware, somenteAdmin, validar(atualizarItemEstoqueSchema), controller.update.bind(controller));
router.delete("/:id", authMiddleware, somenteAdmin, validar(), controller.delete.bind(controller));

export default router;
