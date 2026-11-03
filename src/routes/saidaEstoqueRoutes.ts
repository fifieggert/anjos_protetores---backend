import { Router } from "express";
import { saidaEstoqueController } from "../controller/saidaEstoqueController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar } from "../middleware/validar";
import { criarSaidaEstoqueSchema, atualizarSaidaEstoqueSchema } from "../validators/saidaEstoqueValidator";

const router = Router();
const controller = new saidaEstoqueController();

// saídas de estoque são registradas e consultadas só pela coordenação
router.use(authMiddleware, somenteAdmin);

router.post("/", validar(criarSaidaEstoqueSchema), controller.create.bind(controller));
router.get("/", controller.findAll.bind(controller));
router.get("/:id", validar(), controller.findById.bind(controller));
router.put("/:id", validar(atualizarSaidaEstoqueSchema), controller.update.bind(controller));
router.delete("/:id", validar(), controller.delete.bind(controller));

export default router;
