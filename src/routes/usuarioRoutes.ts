import { Router } from "express";
import { usuarioController } from "../controller/usuarioController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar } from "../middleware/validar";
import { limiteTrocaSenha } from "../middleware/limiteRequisicoes";
import { criarUsuarioSchema, atualizarUsuarioSchema, trocarSenhaSchema } from "../validators/usuarioValidator";

const router = Router();
const controller = new usuarioController();

// Própria senha: qualquer perfil logado. Fica ANTES do router.use(somenteAdmin) e das
// rotas "/:id" para não ser barrada nem confundida com elas.
router.patch(
    "/me/senha",
    authMiddleware,
    limiteTrocaSenha,
    validar(trocarSenhaSchema),
    controller.trocarSenha.bind(controller),
);

// gestão de usuários é exclusiva da coordenação
router.use(authMiddleware, somenteAdmin);

router.post("/", validar(criarUsuarioSchema), controller.create.bind(controller));
router.get("/", controller.findAll.bind(controller));
router.get("/:id", validar(), controller.findById.bind(controller));
router.get("/email/:email", controller.findByEmail.bind(controller));
router.put("/:id", validar(atualizarUsuarioSchema), controller.update.bind(controller));
router.delete("/:id", validar(), controller.delete.bind(controller));

export default router;
