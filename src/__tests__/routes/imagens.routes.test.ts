import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, zerarLimites } from "../helpers/app";
import { comoAdmin, comoVoluntario } from "../helpers/auth";
import { ArmazenamentoMemoria } from "../helpers/armazenamento";
import { definirArmazenamento } from "../../storage";
import { detectarTipoImagem, reencodarImagem } from "../../service/imagemService";

const URL_IMAGEM = /^\/api\/imagens\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const TIPO_INVALIDO = "Formato não suportado. Envie uma imagem JPEG, PNG ou WebP.";
const ARQUIVO = "0f8b2c3d-1e2f-4a5b-8c6d-7e8f9a0b1c2d";

let memoria: ArmazenamentoMemoria;

beforeEach(async () => {
    memoria = new ArmazenamentoMemoria();
    definirArmazenamento(memoria);
    await zerarLimites();
});

type Formato = "jpeg" | "png" | "webp";

function criarImagem(formato: Formato, largura = 40, altura = 30) {
    const base = sharp({ create: { width: largura, height: altura, channels: 3, background: { r: 200, g: 120, b: 40 } } });
    return base[formato]().toBuffer();
}

// PNG com cabeçalho válido declarando dimensões enormes e quase nenhum dado: a "imagem-bomba".
function pngGigante(largura: number, altura: number) {
    const bloco = (tipo: string, dados: Buffer) => {
        const corpo = Buffer.concat([Buffer.from(tipo, "latin1"), dados]);
        const tamanho = Buffer.alloc(4);
        tamanho.writeUInt32BE(dados.length);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(corpo));
        return Buffer.concat([tamanho, corpo, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(largura, 0);
    ihdr.writeUInt32BE(altura, 4);
    ihdr[8] = 8; // 8 bits por canal
    ihdr[9] = 2; // RGB
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        bloco("IHDR", ihdr),
        bloco("IDAT", deflateSync(Buffer.alloc(1000))),
        bloco("IEND", Buffer.alloc(0)),
    ]);
}

function enviar(conteudo: Buffer, nome = "foto.jpg", tipo = "image/jpeg", autorizacao = comoAdmin()) {
    return api().post("/api/imagens").set("Authorization", autorizacao).attach("arquivo", conteudo, { filename: nome, contentType: tipo });
}

const arquivoDaUrl = (url: string) => url.slice("/api/imagens/".length);
const guardado = (url: string) => memoria.arquivos.get(`uploads/${arquivoDaUrl(url)}`);

describe("POST /api/imagens", () => {
    it.each([
        ["jpeg", "foto.jpg", "image/jpeg", "jpg", "image/jpeg"],
        ["png", "foto.png", "image/png", "png", "image/png"],
        ["webp", "foto.webp", "image/webp", "webp", "image/webp"],
    ] as const)("aceita %s: nome aleatório, extensão pelo conteúdo e chave uploads/", async (formato, nome, tipo, ext, mime) => {
        const res = await enviar(await criarImagem(formato), nome, tipo);

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ url: expect.stringMatching(URL_IMAGEM) });
        expect(res.body.url.endsWith(`.${ext}`)).toBe(true);
        expect(res.headers["location"]).toBe(res.body.url);

        const salvo = guardado(res.body.url);
        expect(salvo?.tipoMime).toBe(mime);
        expect((await sharp(salvo?.conteudo).metadata()).format).toBe(formato);
        expect(memoria.arquivos.size).toBe(1);
    });

    it("a extensão vem do conteúdo, não do nome nem do Content-Type enviado", async () => {
        const res = await enviar(await criarImagem("png"), "foto.jpg", "image/jpeg");
        expect(res.status).toBe(201);
        expect(res.body.url.endsWith(".png")).toBe(true);
    });

    it("reencoda: remove EXIF/GPS e limita o maior lado a 1600 px", async () => {
        const comExif = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#336699" } })
            .withExif({ IFD0: { Copyright: "Abrigo", Make: "Celular" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "26/1 55/1 0/1" } })
            .jpeg()
            .toBuffer();
        expect((await sharp(comExif).metadata()).exif).toBeDefined();

        const res = await enviar(comExif);

        const meta = await sharp(guardado(res.body.url)?.conteudo).metadata();
        expect(res.status).toBe(201);
        expect([meta.width, meta.height]).toEqual([1600, 800]);
        expect(meta.exif).toBeUndefined();
    });

    it("aplica a rotação do EXIF antes de removê-lo e não amplia imagens pequenas", async () => {
        const deitada = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#000" } })
            .jpeg()
            .withMetadata({ orientation: 6 })
            .toBuffer();

        const res = await enviar(deitada);

        const meta = await sharp(guardado(res.body.url)?.conteudo).metadata();
        expect([meta.width, meta.height]).toEqual([20, 40]);
        expect(meta.orientation).toBeUndefined();
    });

    it("VOLUNTARIO pode enviar", async () => {
        const res = await enviar(await criarImagem("webp"), "a.webp", "image/webp", comoVoluntario());
        expect(res.status).toBe(201);
    });

    it("sem token dá 401 e nada é guardado", async () => {
        const res = await api().post("/api/imagens").attach("arquivo", await criarImagem("png"), "a.png");
        expect(res.status).toBe(401);
        expect(memoria.arquivos.size).toBe(0);
    });

    it("arquivo acima de 5 MB dá 413", async () => {
        const grande = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)]);
        const res = await enviar(grande);
        expect(res.status).toBe(413);
        expect(res.body).toEqual({ error: "A imagem deve ter no máximo 5 MB." });
        expect(memoria.arquivos.size).toBe(0);
    });

    it.each([
        ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "a.svg", "image/svg+xml"],
        ["texto renomeado para .png", Buffer.from("isto não é uma imagem"), "a.png", "image/png"],
        ["GIF", Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00", "latin1"), "a.gif", "image/gif"],
        ["PDF", Buffer.from("%PDF-1.7\n"), "a.jpg", "image/jpeg"],
        ["RIFF que não é WebP (WAV)", Buffer.from("RIFF\x24\x00\x00\x00WAVEfmt ", "latin1"), "a.webp", "image/webp"],
        ["vazio", Buffer.alloc(0), "a.png", "image/png"],
    ])("recusa %s com 415", async (_caso, conteudo, nome, tipo) => {
        const res = await enviar(conteudo, nome, tipo);
        expect(res.status).toBe(415);
        expect(res.body).toEqual({ error: TIPO_INVALIDO });
        expect(memoria.arquivos.size).toBe(0);
    });

    it("assinatura de JPEG com conteúdo corrompido dá 415", async () => {
        const res = await enviar(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("lixo".repeat(50))]));
        expect(res.status).toBe(415);
        expect(res.body.error).toMatch(/corrompido/);
    });

    it("imagem-bomba (dimensões enormes) dá 413 sem ser decodificada", async () => {
        const res = await enviar(pngGigante(20_000, 20_000), "bomba.png", "image/png");
        expect(res.status).toBe(413);
        expect(res.body).toEqual({ error: "A imagem tem dimensões grandes demais (máximo de 50 megapixels)." });
    });

    it("sem arquivo dá 400", async () => {
        const vazio = await api().post("/api/imagens").set("Authorization", comoAdmin()).field("outro", "x");
        const json = await api().post("/api/imagens").set("Authorization", comoAdmin()).send({ url: "x" });
        for (const res of [vazio, json]) {
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Nenhum arquivo enviado. Envie a imagem no campo "arquivo".' });
        }
    });

    it("arquivo em outro campo ou mais de um arquivo dá 400", async () => {
        const img = await criarImagem("png");
        const outroCampo = await api().post("/api/imagens").set("Authorization", comoAdmin()).attach("foto", img, "a.png");
        const dois = await api()
            .post("/api/imagens")
            .set("Authorization", comoAdmin())
            .attach("arquivo", img, "a.png")
            .attach("arquivo", img, "b.png");
        for (const res of [outroCampo, dois]) {
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Envie um único arquivo, no campo "arquivo".' });
        }
        expect(memoria.arquivos.size).toBe(0);
    });

    it("campos extras demais dá 400", async () => {
        let req = api().post("/api/imagens").set("Authorization", comoAdmin());
        for (let i = 0; i < 6; i++) req = req.field(`c${i}`, "x");
        const res = await req;
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Envio inválido. Mande só a imagem no campo "arquivo".' });
    });

    it("multipart malformado dá 400", async () => {
        const res = await api()
            .post("/api/imagens")
            .set("Authorization", comoAdmin())
            .set("Content-Type", "multipart/form-data; boundary=limite")
            .send('--limite\r\nContent-Disposition: form-data; name="arquivo"; filename="a.png"\r\n\r\nsem fim');
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Corpo multipart inválido ou incompleto." });
    });

    it("armazenamento desabilitado (ex.: produção sem S3_BUCKET) dá 503 e nada é gravado", async () => {
        definirArmazenamento(null);
        const res = await enviar(await criarImagem("png"), "a.png", "image/png");
        expect(res.status).toBe(503);
        expect(res.body).toEqual({
            error: "O envio de imagens não está disponível no momento: o armazenamento não foi configurado no servidor.",
        });
    });

    it("falha do armazenamento dá 500 genérico", async () => {
        vi.spyOn(memoria, "salvar").mockRejectedValue(new Error("S3 fora do ar"));
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const res = await enviar(await criarImagem("jpeg"));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno do servidor." });
    });

    it("limite de 30 envios por usuário a cada 15 minutos", async () => {
        const semArquivo = (autorizacao: string) => api().post("/api/imagens").set("Authorization", autorizacao);
        for (let i = 0; i < 30; i++) expect((await semArquivo(comoAdmin())).status).toBe(400);

        const bloqueado = await semArquivo(comoAdmin());
        expect(bloqueado.status).toBe(429);
        expect(bloqueado.body).toEqual({ error: "Muitos envios de imagens. Tente novamente em alguns minutos." });
        // outro usuário (mesmo IP) não é afetado
        expect((await semArquivo(comoVoluntario())).status).toBe(400);
    });
});

describe("GET /api/imagens/:arquivo", () => {
    it("devolve a imagem com tipo, cache longo, nosniff e CORP cross-origin; sem token", async () => {
        const envio = await enviar(await criarImagem("webp"), "a.webp", "image/webp");

        const res = await api().get(envio.body.url);

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toBe("image/webp");
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
        expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
        expect(Buffer.compare(res.body as Buffer, guardado(envio.body.url)?.conteudo as Buffer)).toBe(0);
    });

    it.each([
        ["jpg", "image/jpeg"],
        ["png", "image/png"],
    ])("Content-Type pela extensão .%s", async (ext, mime) => {
        await memoria.salvar(`uploads/${ARQUIVO}.${ext}`, Buffer.from("x"), "ignorado");
        const res = await api().get(`/api/imagens/${ARQUIVO}.${ext}`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toBe(mime);
    });

    it("imagem inexistente dá 404 (sem liberar CORP nem cache)", async () => {
        const res = await api().get(`/api/imagens/${ARQUIVO}.jpg`);
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Imagem não encontrada." });
        expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
        expect(res.headers["cache-control"]).toBeUndefined();
    });

    it.each([
        `${ARQUIVO}.gif`,
        `${ARQUIVO}.jpeg`,
        `${ARQUIVO}.JPG`,
        `${ARQUIVO.toUpperCase()}.jpg`,
        `${ARQUIVO}.jpg.png.svg`,
        `${ARQUIVO}x.jpg`,
        "foto.jpg",
        "..%2F..%2Fetc%2Fpasswd",
        "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        `..%2Fuploads%2F${ARQUIVO}.jpg`,
        "..%5C..%5Cwindows%5Cwin.ini",
        `${ARQUIVO}.jpg%00.png`,
    ])("nome inválido dá 400 sem consultar o armazenamento: %s", async (arquivo) => {
        const ler = vi.spyOn(memoria, "ler");
        const res = await api().get(`/api/imagens/${arquivo}`);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Nome de arquivo de imagem inválido." });
        expect(ler).not.toHaveBeenCalled();
    });

    it.each(["/api/imagens/../../etc/passwd", "/api/imagens/a/b.jpg", `/api/imagens/uploads/${ARQUIVO}.jpg`])(
        "caminho com barras não chega à rota: %s",
        async (caminho) => {
            const ler = vi.spyOn(memoria, "ler");
            const res = await api().get(caminho);
            expect(res.status).toBe(404);
            expect(ler).not.toHaveBeenCalled();
        },
    );

    it("armazenamento desabilitado dá 503", async () => {
        definirArmazenamento(null);
        const res = await api().get(`/api/imagens/${ARQUIVO}.png`);
        expect(res.status).toBe(503);
    });

    // 300 requisições: ~1 s sozinho, mas passa de 5 s (timeout padrão) com cobertura e todos
    // os arquivos rodando em paralelo.
    const TIMEOUT_300_LEITURAS = 20_000;

    it("limite folgado de 300 leituras por IP por minuto: dentro dele serve normalmente, acima dá 429", async () => {
        await memoria.salvar(`uploads/${ARQUIVO}.jpg`, Buffer.from("x"), "image/jpeg");
        const ler = () => api().get(`/api/imagens/${ARQUIVO}.jpg`);

        for (let i = 0; i < 300; i++) {
            const res = await ler();
            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toBe("image/jpeg");
        }

        const lerSpy = vi.spyOn(memoria, "ler");
        const bloqueado = await ler();
        expect(bloqueado.status).toBe(429);
        expect(bloqueado.body).toEqual({ error: "Muitas requisições de imagens. Tente novamente em instantes." });
        expect(bloqueado.headers["ratelimit-policy"]).toMatch(/^"300-in-1min"; q=300; w=60;/);
        expect(lerSpy).not.toHaveBeenCalled();
    }, TIMEOUT_300_LEITURAS);

    it("estourar o limite de leitura não afeta o upload, e os envios não contam para a leitura", async () => {
        await memoria.salvar(`uploads/${ARQUIVO}.png`, Buffer.from("x"), "image/png");
        for (let i = 0; i < 300; i++) await api().get(`/api/imagens/${ARQUIVO}.png`);
        expect((await api().get(`/api/imagens/${ARQUIVO}.png`)).status).toBe(429);

        const envio = await enviar(await criarImagem("png"), "a.png", "image/png");
        expect(envio.status).toBe(201);

        await zerarLimites();
        for (let i = 0; i < 29; i++) {
            expect((await api().post("/api/imagens").set("Authorization", comoAdmin())).status).toBe(400);
        }
        expect((await api().get(`/api/imagens/${ARQUIVO}.png`)).status).toBe(200);
    }, TIMEOUT_300_LEITURAS);
});

describe("detectarTipoImagem e reencodarImagem", () => {
    it("só reconhece JPEG, PNG e WebP pelos bytes iniciais", () => {
        expect(detectarTipoImagem(Buffer.from([0xff, 0xd8, 0xff]))).toBe("jpg");
        expect(detectarTipoImagem(Buffer.from([0xff, 0xd8]))).toBeNull();
        expect(detectarTipoImagem(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]))).toBeNull();
        expect(detectarTipoImagem(Buffer.from("RIFF\0\0\0\0WEBP", "latin1"))).toBe("webp");
        expect(detectarTipoImagem(Buffer.from("RIFF\0\0\0\0WEB", "latin1"))).toBeNull();
        expect(detectarTipoImagem(Buffer.from("RIFX\0\0\0\0WEBP", "latin1"))).toBeNull();
    });

    it("respeita o limite de pixels informado", async () => {
        const imagem = await criarImagem("png", 100, 100);
        await expect(reencodarImagem(imagem, "png", 100 * 100)).resolves.toBeInstanceOf(Buffer);
        await expect(reencodarImagem(imagem, "png", 100 * 100 - 1)).rejects.toMatchObject({ status: 413 });
    });
});
