import { Router } from "express";
import prisma from "../config/prisma";

const router = Router();

// Sem banco, o pool do adapter MariaDB fica ~10 s tentando conectar antes de falhar; a
// readiness responde antes disso para o load balancer não esperar.
const PRAZO_BANCO_MS = 3_000;

function comPrazo<T>(promessa: Promise<T>, prazoMs: number): Promise<T> {
    let limite: NodeJS.Timeout | undefined;
    const esgotado = new Promise<never>((_resolve, rejeitar) => {
        limite = setTimeout(
            () => rejeitar(Object.assign(new Error("Tempo esgotado."), { name: "TempoEsgotado" })),
            prazoMs,
        );
    });
    return Promise.race([promessa, esgotado]).finally(() => clearTimeout(limite));
}

// Liveness: o processo está de pé. Não toca no banco (o HEALTHCHECK do Docker usa esta).
router.get("/", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

// Readiness: a API consegue falar com o banco. A resposta nunca traz detalhes do erro, e o
// log só o tipo: a mensagem do driver pode conter host e usuário do banco.
router.get("/ready", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
        await comPrazo(prisma.$queryRaw`SELECT 1`, PRAZO_BANCO_MS);
        res.status(200).json({ status: "ok" });
    } catch (erro) {
        console.error(`[health] banco indisponível: ${erro instanceof Error ? erro.name : typeof erro}`);
        res.status(503).json({ status: "indisponivel" });
    }
});

export default router;
