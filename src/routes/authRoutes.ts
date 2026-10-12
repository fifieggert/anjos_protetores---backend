import { Router } from "express";
import { authController } from "../controller/authController";

const router = Router();
const controller = new authController();

router.post("/login", controller.login.bind(controller));

export default router;
