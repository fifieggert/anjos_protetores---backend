import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import healthRoutes from "./routes/healthRoutes";
import { CORS_ORIGINS, TRUST_PROXY } from "./config/env";
import { rotaNaoEncontrada, tratarErros } from "./middleware/errorMiddleware";

const app = express();

// IP real do visitante atrás do Nginx (limitador de requisições); desligado por padrão.
app.set("trust proxy", TRUST_PROXY);

app.use(helmet());
app.use(cors({ origin: CORS_ORIGINS }));

// Rotas de saúde fora do /api, sem autenticação nem limitador, e antes do morgan para as
// checagens periódicas (Docker, load balancer) não encherem o log.
app.use("/health", healthRoutes);

app.use(morgan("dev"));
app.use(express.json());

app.use("/api", routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

export default app;
