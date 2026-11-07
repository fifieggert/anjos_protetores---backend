import { rateLimit } from "express-rate-limit";
import { usuarioLogado } from "./authMiddleware";

// Limite por IP para o formulário público de interesse (evita spam e reservas em massa).
// Contagem em memória: zera quando o servidor reinicia. Atrás de um proxy (ex.: Render,
// Nginx), configure app.set("trust proxy", ...) para o IP real do visitante ser usado.
export const limiteInteresses = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitas tentativas de registrar interesse. Tente novamente mais tarde." },
});

// Troca da própria senha: freia quem tenta adivinhar a senha atual com um token roubado.
// Só as respostas com erro contam (skipSuccessfulRequests), então quem acerta não é travado.
export const limiteTrocaSenha = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitas tentativas de trocar a senha. Tente novamente em alguns minutos." },
});

// Upload de imagens: cada envio ocupa memória e CPU (reencode). A contagem é por usuário (vem
// depois do authMiddleware), porque os voluntários de um mesmo abrigo podem sair pelo mesmo IP.
export const limiteUploads = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => usuarioLogado(req).id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitos envios de imagens. Tente novamente em alguns minutos." },
});
