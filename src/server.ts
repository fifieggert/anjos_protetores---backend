import "dotenv/config";
import "./config/env";
import app from "./app";
import prisma from "./config/prisma";
import { registrarEncerramento } from "./utils/encerramento";

const PORT = process.env["PORT"] ? Number(process.env["PORT"]) : 4000;

const servidor = app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// SIGTERM/SIGINT (docker stop, deploy, Ctrl+C): fecha o HTTP e desconecta o Prisma.
registrarEncerramento(servidor, () => prisma.$disconnect());
