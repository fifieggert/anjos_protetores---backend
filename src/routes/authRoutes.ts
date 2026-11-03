import { Router } from "express";
import { authController } from "../controller/authController";
import { validar } from "../middleware/validar";
import { loginSchema } from "../validators/authValidator";

const router = Router();
const controller = new authController();

router.post("/login", validar(loginSchema), controller.login.bind(controller));

export default router;
