import { Router } from "express";
import { usuarioController } from "../controller/usuarioController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar } from "../middleware/validar";
import { criarUsuarioSchema, atualizarUsuarioSchema } from "../validators/usuarioValidator";

const router = Router();
const controller = new usuarioController();

// gestão de usuários é exclusiva da coordenação
router.use(authMiddleware, somenteAdmin);

router.post("/", validar(criarUsuarioSchema), controller.create.bind(controller));
router.get("/", controller.findAll.bind(controller));
router.get("/:id", validar(), controller.findById.bind(controller));
router.get("/email/:email", controller.findByEmail.bind(controller));
router.put("/:id", validar(atualizarUsuarioSchema), controller.update.bind(controller));
router.delete("/:id", validar(), controller.delete.bind(controller));

export default router;
