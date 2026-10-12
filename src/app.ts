import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { CORS_ORIGINS } from "./config/env";

const app = express();

app.use(helmet());
app.use(cors({ origin: CORS_ORIGINS }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api", routes);

app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Rota não encontrada." });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Erro interno do servidor." });
});

export default app;
