import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { CORS_ORIGINS } from "./config/env";
import { rotaNaoEncontrada, tratarErros } from "./middleware/errorMiddleware";

const app = express();

app.use(helmet());
app.use(cors({ origin: CORS_ORIGINS }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api", routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

export default app;
