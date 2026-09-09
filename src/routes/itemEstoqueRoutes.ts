import { Router } from "express";
import { itemEstoqueController } from "../controller/itemEstoqueController";

const router = Router();
const controller = new itemEstoqueController();

router.post("/", controller.create.bind(controller));
router.get("/", controller.findAll.bind(controller));
router.get("/:id", controller.findById.bind(controller));
router.put("/:id", controller.update.bind(controller));
router.delete("/:id", controller.delete.bind(controller));

export default router;
