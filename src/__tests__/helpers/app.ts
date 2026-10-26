import request from "supertest";
import app from "../../app";
import { limiteInteresses, limiteTrocaSenha } from "../../middleware/limiteRequisicoes";

// O supertest sobe o app numa porta local temporária (sem app.listen do server.ts).
export const api = () => request(app);

// Os limitadores contam em memória por IP; zerar antes de cada teste evita que um teste
// dependa de quantas requisições os anteriores fizeram.
const IPS_LOCAIS = ["127.0.0.1", "::1", "::", "::ffff:127.0.0.1"];

export async function zerarLimites() {
    for (const ip of IPS_LOCAIS) {
        await limiteInteresses.resetKey(ip);
        await limiteTrocaSenha.resetKey(ip);
    }
}
