import "dotenv/config";
// Sentry antes dos demais imports, para instrumentar o Express e o HTTP (ver instrument.ts).
import { avisarApiIniciada } from "./instrument";
import "./config/env";
import app from "./app";
import prisma from "./config/prisma";
import { registrarEncerramento } from "./utils/encerramento";

const PORT = process.env["PORT"] ? Number(process.env["PORT"]) : 4000;

const servidor = app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    // Só com o Sentry ligado (SENTRY_DSN definida): confirma a integração no painel.
    avisarApiIniciada();
});

// SIGTERM/SIGINT (docker stop, deploy, Ctrl+C): fecha o HTTP e desconecta o Prisma.
registrarEncerramento(servidor, () => prisma.$disconnect());
