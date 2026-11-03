import { Router } from "express";
import { dashboardController } from "../controller/dashboardController";
import { authMiddleware, somenteAdmin } from "../middleware/authMiddleware";

const router = Router();
const controller = new dashboardController();

// Painel da coordenação: só ADMIN (sem token: 401; VOLUNTARIO: 403).
router.get("/", authMiddleware, somenteAdmin, controller.resumo.bind(controller));

export default router;
