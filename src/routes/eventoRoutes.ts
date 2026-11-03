import { Router } from "express";
import { eventoController } from "../controller/eventoController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar, validarConsulta } from "../middleware/validar";
import { atualizarEventoSchema, criarEventoSchema, filtrosEventoSchema } from "../validators/eventoValidator";

const router = Router();
const controller = new eventoController();

// Cadastro de eventos é da coordenação. O site público lê em GET /api/publico/eventos.
router.use(authMiddleware, somenteAdmin);

router.post("/", validar(criarEventoSchema), controller.create.bind(controller));
router.get("/", validarConsulta(filtrosEventoSchema), controller.findAll.bind(controller));
router.get("/:id", validar(), controller.findById.bind(controller));
router.put("/:id", validar(atualizarEventoSchema), controller.update.bind(controller));
router.delete("/:id", validar(), controller.delete.bind(controller));

export default router;
