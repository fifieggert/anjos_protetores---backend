import { Router } from "express";
import { usuarioController } from "../controller/usuarioController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";

const router = Router();
const controller = new usuarioController();

// gestão de usuários é exclusiva da coordenação
router.use(authMiddleware, somenteAdmin);

router.post("/", controller.create.bind(controller));
router.get("/", controller.findAll.bind(controller));
router.get("/:id", controller.findById.bind(controller));
router.get("/email/:email", controller.findByEmail.bind(controller));
router.put("/:id", controller.update.bind(controller));
router.delete("/:id", controller.delete.bind(controller));

export default router;
