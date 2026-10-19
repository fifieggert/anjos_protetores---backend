import { Router } from "express";
import { publicoController } from "../controller/publicoController";
import { limiteInteresses } from "../middleware/limiteRequisicoes";
import { validar } from "../middleware/validar";
import { registrarInteresseSchema } from "../validators/solicitacaoAdocaoValidator";

const router = Router();
const controller = new publicoController();

// rotas do site público: sem autenticação e só com dados que podem ser exibidos
router.get("/animais", controller.listarAnimais.bind(controller));
// única porta de entrada de interesses de adoção
router.post("/interesses", limiteInteresses, validar(registrarInteresseSchema), controller.registrarInteresse.bind(controller));

export default router;
