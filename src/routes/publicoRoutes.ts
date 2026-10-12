import { Router } from "express";
import { publicoController } from "../controller/publicoController";

const router = Router();
const controller = new publicoController();

// rotas do site público: sem autenticação e só com dados que podem ser exibidos
router.get("/animais", controller.listarAnimais.bind(controller));

export default router;
