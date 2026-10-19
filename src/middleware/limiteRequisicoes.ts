import { rateLimit } from "express-rate-limit";

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
