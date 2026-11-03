// TRUST_PROXY: quantos proxies reversos (ex.: Nginx, load balancer) ficam à frente da API.
// Com N > 0, o Express usa o IP do X-Forwarded-For a N saltos do servidor como req.ip,
// e o limitador de requisições conta pelo IP real do visitante.
// Vazio, "0" ou "false" = desligado (padrão em desenvolvimento): o X-Forwarded-For é
// ignorado, para ninguém fugir do limite forjando o header.
// Só aceita número de saltos, não "true" (confiaria em qualquer X-Forwarded-For) nem
// faixas de IP.
export function lerTrustProxy(valor: string | undefined): number | false {
    const texto = valor?.trim() ?? "";
    if (texto === "" || texto === "0" || texto.toLowerCase() === "false") return false;

    if (!/^[1-9]\d?$/.test(texto)) {
        throw new Error(
            `TRUST_PROXY deve ser o número de proxies à frente da API (ex.: 1), ou vazio para desligar: "${texto}".`,
        );
    }
    return Number(texto);
}
