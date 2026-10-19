import { Router } from "express";
import { solicitacaoAdocaoController } from "../controller/solicitacaoAdocaoController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";
import { validar, validarConsulta } from "../middleware/validar";
import { atualizarStatusSolicitacaoSchema, filtrosSolicitacaoSchema } from "../validators/solicitacaoAdocaoValidator";

const router = Router();
const controller = new solicitacaoAdocaoController();

// Tudo aqui é da coordenação: as solicitações têm nome e telefone dos interessados.
// O registro de interesse (público) é feito em POST /api/publico/interesses.
router.use(authMiddleware, somenteAdmin);

router.get("/", validarConsulta(filtrosSolicitacaoSchema), controller.findAll.bind(controller));
router.get("/:id", validar(), controller.findById.bind(controller));
// só PENDENTE -> EM_CONTATO; as demais mudanças passam por /concluir e /cancelar
router.patch("/:id", validar(atualizarStatusSolicitacaoSchema), controller.marcarEmContato.bind(controller));
router.post("/:id/concluir", validar(), controller.concluir.bind(controller));
router.post("/:id/cancelar", validar(), controller.cancelar.bind(controller));
router.delete("/:id", validar(), controller.delete.bind(controller));

export default router;
