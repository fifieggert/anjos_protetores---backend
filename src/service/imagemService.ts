import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { AppError } from "../utils/AppError";
import { criarFilaUnica } from "../utils/filaUnica";
import { exigirArmazenamento } from "../storage";
import {
    TIPOS_MIME,
    chaveDaImagem,
    ehArquivoImagem,
    extensaoDoArquivo,
    urlDaImagem,
} from "../storage/chaves";
import type { ExtensaoImagem } from "../storage/chaves";

// Maior lado da imagem gravada: suficiente para a página do abrigo e bem mais leve que a
// foto original do celular.
export const LADO_MAXIMO = 1600;
// Proteção contra "imagem-bomba" (arquivo pequeno que declara dimensões enormes e estoura a
// memória ao ser aberto). 25 MP cobre fotos de celular no modo padrão (12 a 24 MP) e limita o
// pior caso medido (PNG entrelaçado, decodificado inteiro na memória) a algumas centenas de MB
// (números em docs/upload.md).
export const LIMITE_PIXELS = 25_000_000;

export const MENSAGEM_TIPO_INVALIDO = "Formato não suportado. Envie uma imagem JPEG, PNG ou WebP.";
const MENSAGEM_IMAGEM_CORROMPIDA = "Não foi possível ler a imagem: o arquivo está corrompido ou não é JPEG, PNG ou WebP.";
const MENSAGEM_DIMENSOES = `A imagem tem dimensões grandes demais (máximo de ${LIMITE_PIXELS / 1_000_000} megapixels).`;

// Servidor pequeno (t3.micro, 1 GB): sem cache de arquivos abertos e uma thread do libvips
// por imagem. sharp.concurrency(1) NÃO impede duas requisições de processarem ao mesmo tempo
// (cada uma vai para uma thread do libuv); quem garante uma imagem por vez é a fila abaixo.
sharp.cache(false);
sharp.concurrency(1);

// Uma imagem por vez no processo (metadata + reencode). Quem chega depois espera a vez; a
// espera é curta (cada imagem leva décimos de segundo) e não há timeout de resposta na API.
const filaImagens = criarFilaUnica();

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Tipo pelo CONTEÚDO (magic bytes), nunca pelo nome do arquivo ou pelo Content-Type enviado.
// Qualquer outro formato (SVG, GIF, HEIC, PDF, texto...) é recusado.
export function detectarTipoImagem(conteudo: Buffer): ExtensaoImagem | null {
    if (conteudo.length >= 3 && conteudo[0] === 0xff && conteudo[1] === 0xd8 && conteudo[2] === 0xff) return "jpg";
    if (conteudo.subarray(0, 8).equals(ASSINATURA_PNG)) return "png";
    if (
        conteudo.length >= 12 &&
        conteudo.toString("latin1", 0, 4) === "RIFF" &&
        conteudo.toString("latin1", 8, 12) === "WEBP"
    ) {
        return "webp";
    }
    return null;
}

// Decodifica e grava de novo no mesmo formato. Isso:
// - confirma que o arquivo é mesmo uma imagem válida (não só o começo dela);
// - remove EXIF (incluindo a localização GPS da foto), comentários e qualquer conteúdo extra
//   escondido no arquivo; a rotação do EXIF é aplicada antes, para a foto não ficar deitada;
// - limita o maior lado a LADO_MAXIMO (sem ampliar imagens menores);
// - em GIF/WebP animados, fica só o primeiro quadro.
// Passa pela fila: nunca há duas imagens sendo processadas ao mesmo tempo.
export function reencodarImagem(conteudo: Buffer, tipo: ExtensaoImagem, limitePixels = LIMITE_PIXELS) {
    return filaImagens(() => processarImagem(conteudo, tipo, limitePixels));
}

async function processarImagem(conteudo: Buffer, tipo: ExtensaoImagem, limitePixels: number) {
    // Confere as dimensões ANTES de decodificar: lê só o cabeçalho e não depende do texto
    // de erro do sharp (que pode mudar entre versões).
    // limitInputPixels: false é necessário aqui: o limite padrão do sharp (~268 MP) também vale
    // para o metadata(), que então LANÇA para imagens maiores que isso, e uma imagem-bomba
    // viraria 415 em vez de 413. Nada é decodificado nesta etapa; o limite real é conferido
    // logo abaixo com limitePixels.
    let largura: number | undefined;
    let altura: number | undefined;
    try {
        ({ width: largura, height: altura } = await sharp(conteudo, { failOn: "none", limitInputPixels: false }).metadata());
    } catch {
        throw new AppError(415, MENSAGEM_IMAGEM_CORROMPIDA);
    }
    if (!largura || !altura) throw new AppError(415, MENSAGEM_IMAGEM_CORROMPIDA);
    if (largura * altura > limitePixels) throw new AppError(413, MENSAGEM_DIMENSOES);

    const imagem = sharp(conteudo, { limitInputPixels: limitePixels, failOn: "error" })
        .rotate()
        .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true });

    const formatada =
        tipo === "jpg" ? imagem.jpeg({ quality: 82 }) : tipo === "png" ? imagem.png() : imagem.webp({ quality: 80 });

    try {
        return await formatada.toBuffer();
    } catch {
        throw new AppError(415, MENSAGEM_IMAGEM_CORROMPIDA);
    }
}

export class imagemService {
    // Valida, reencoda e guarda a imagem com nome aleatório. Devolve o caminho público.
    async salvar(conteudo: Buffer) {
        const armazenamento = exigirArmazenamento();

        const tipo = detectarTipoImagem(conteudo);
        if (!tipo) throw new AppError(415, MENSAGEM_TIPO_INVALIDO);

        const imagem = await reencodarImagem(conteudo, tipo);
        const arquivo = `${randomUUID()}.${tipo}`;
        await armazenamento.salvar(chaveDaImagem(arquivo), imagem, TIPOS_MIME[tipo]);

        return { url: urlDaImagem(arquivo) };
    }

    // null quando a imagem não existe.
    async ler(arquivo: string) {
        if (!ehArquivoImagem(arquivo)) throw new AppError(400, "Nome de arquivo de imagem inválido.");

        const conteudo = await exigirArmazenamento().ler(chaveDaImagem(arquivo));
        if (!conteudo) return null;

        return { conteudo, tipoMime: TIPOS_MIME[extensaoDoArquivo(arquivo)] };
    }
}
