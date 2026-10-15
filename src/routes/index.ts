import { Router } from "express";
import authRoutes from "./authRoutes";
import publicoRoutes from "./publicoRoutes";
import animalRoutes from "./animalRoutes";
import usuarioRoutes from "./usuarioRoutes";
import itemEstoqueRoutes from "./itemEstoqueRoutes";
import doacaoRoutes from "./doacaoRoutes";
import saidaEstoqueRoutes from "./saidaEstoqueRoutes";
import solicitacaoAdocaoRoutes from "./solicitacaoAdocaoRoutes";
import termoAdocaoRoutes from "./termoAdocaoRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/publico", publicoRoutes);
router.use("/animais", animalRoutes);
router.use("/usuarios", usuarioRoutes);
router.use("/itens-estoque", itemEstoqueRoutes);
router.use("/doacoes", doacaoRoutes);
router.use("/saidas-estoque", saidaEstoqueRoutes);
router.use("/solicitacoes-adocao", solicitacaoAdocaoRoutes);
router.use("/termos-adocao", termoAdocaoRoutes);

export default router;
