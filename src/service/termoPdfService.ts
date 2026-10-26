import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { Especie, Porte } from "@prisma/client";
import type { TermoParaPdf } from "../repository/termoAdocaoRepository";
import { diaDoBanco, hoje } from "../utils/datas";
import {
    DECLARACAO_FINAL,
    INTRODUCAO,
    NOME_ABRIGO,
    ROTULO_ASSINATURA_ABRIGO,
    ROTULO_ASSINATURA_ADOTANTE,
    TITULO_TERMO,
    clausulas,
} from "./termoTexto";

// Logo opcional em src/assets/logo-anjos.png. O tsc não copia imagens para dist/, então
// rodando de dist/ o arquivo é procurado também em src/assets. Sem o arquivo, o PDF sai sem logo.
const CAMINHOS_LOGO = [
    path.resolve(__dirname, "..", "assets", "logo-anjos.png"),
    path.resolve(__dirname, "..", "..", "src", "assets", "logo-anjos.png"),
];

function caminhoDoLogo() {
    return CAMINHOS_LOGO.find((caminho) => fs.existsSync(caminho)) ?? null;
}

// A4 = 595 x 842 pt.
const MARGENS = { top: 48, bottom: 60, left: 56, right: 56 };
const NORMAL = "Helvetica";
const NEGRITO = "Helvetica-Bold";
const TAMANHO = 9.5;
const COR_TEXTO = "#172839";
const COR_SECUNDARIA = "#5b6876";
const COR_DESTAQUE = "#0b6e86";
const COR_LINHA = "#8a96a3";

const ROTULOS_ESPECIE: Record<Especie, string> = { CACHORRO: "Cachorro", GATO: "Gato", OUTRO: "Outro" };
const ROTULOS_PORTE: Record<Porte, string> = { PEQUENO: "Pequeno", MEDIO: "Médio", GRANDE: "Grande" };

export interface OpcoesTermoPdf {
    // fecho "Cidade, ____/____/______"; null = linha em branco
    cidade: string | null;
    // telefone abaixo da assinatura do responsável; null = linha em branco
    telefoneAbrigo: string | null;
}

interface Campo {
    rotulo: string;
    // null ou vazio = linha em branco para preencher à mão
    valor: string | null;
    // fração da largura da linha ocupada pelo campo
    fracao: number;
}

// Data de calendário (castração, revacinação) -> DD/MM/AAAA pelo dia em UTC, como o frontend
// (diaDaApi). Sem converter para o fuso do abrigo: "AAAA-MM-DD" gravado à meia-noite UTC
// sairia no dia anterior; o meio-dia local enviado pelo frontend fica no mesmo dia em UTC.
function dataBR(data: Date | null) {
    if (!data) return null;
    const [ano, mes, dia] = diaDoBanco(data).split("-");
    return `${dia}/${mes}/${ano}`;
}

function formatarTelefone(digitos: string) {
    const partes = /^(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
    return partes ? `(${partes[1]}) ${partes[2]}-${partes[3]}` : digitos;
}

function textoIdade(idade: number | null) {
    if (idade === null) return "Não informada";
    return `${idade} ${idade === 1 ? "ano" : "anos"}`;
}

function marcador(marcado: boolean) {
    return marcado ? "( X )" : "(    )";
}

// Nome de arquivo seguro: sem acentos, só letras minúsculas, números e hífens.
export function nomeArquivoTermo(nomeAnimal: string) {
    const base = nomeAnimal
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/g, "");
    return `termo-adocao-${base || "animal"}.pdf`;
}

// Gera o termo em PDF (A4, até 2 páginas). Os dados vêm do banco no momento da geração.
// Contém nome e telefone do interessado: o Buffer só vai para a resposta, nunca para log.
export function gerarTermoPdf(termo: TermoParaPdf, opcoes: OpcoesTermoPdf): Promise<Buffer> {
    const doc = new PDFDocument({
        size: "A4",
        margins: MARGENS,
        bufferPages: true,
        info: { Title: TITULO_TERMO, Author: NOME_ABRIGO },
    });

    const partes: Buffer[] = [];
    const pronto = new Promise<Buffer>((resolve, reject) => {
        doc.on("data", (parte: Buffer) => partes.push(parte));
        doc.on("end", () => resolve(Buffer.concat(partes)));
        doc.on("error", reject);
    });

    const esquerda = MARGENS.left;
    const largura = doc.page.width - MARGENS.left - MARGENS.right;
    const limiteInferior = () => doc.page.height - MARGENS.bottom;

    // Começa uma página nova se não couber a altura pedida (evita título ou assinatura sozinhos).
    function garantirEspaco(altura: number) {
        if (doc.y + altura > limiteInferior()) doc.addPage();
    }

    function paragrafo(texto: string, espacoDepois = 0.5) {
        doc.font(NORMAL).fontSize(TAMANHO).fillColor(COR_TEXTO);
        doc.text(texto, esquerda, doc.y, { width: largura, align: "justify" });
        doc.moveDown(espacoDepois);
    }

    function secao(titulo: string) {
        garantirEspaco(60);
        doc.moveDown(0.4);
        doc.font(NEGRITO).fontSize(10.5).fillColor(COR_DESTAQUE);
        doc.text(titulo.toUpperCase(), esquerda, doc.y, { width: largura });
        const y = doc.y + 2;
        doc.moveTo(esquerda, y).lineTo(esquerda + largura, y).lineWidth(0.6).strokeColor(COR_DESTAQUE).stroke();
        doc.y = y + 6;
    }

    // Uma linha com um ou mais campos lado a lado. Valores longos quebram dentro da coluna.
    function linhaDeCampos(campos: Campo[]) {
        garantirEspaco(TAMANHO * 2.5);
        const y = doc.y;
        let x = esquerda;
        let yMaximo = y;

        for (const campo of campos) {
            const larguraColuna = largura * campo.fracao;
            const rotulo = `${campo.rotulo}: `;
            doc.font(NEGRITO).fontSize(TAMANHO).fillColor(COR_TEXTO);
            const larguraRotulo = doc.widthOfString(rotulo);
            doc.text(rotulo, x, y, { lineBreak: false });

            const xValor = x + larguraRotulo;
            const larguraValor = Math.max(20, larguraColuna - larguraRotulo - 12);
            if (campo.valor) {
                doc.font(NORMAL).text(campo.valor, xValor, y, { width: larguraValor });
                yMaximo = Math.max(yMaximo, doc.y);
            } else {
                const yLinha = y + TAMANHO + 1;
                doc.moveTo(xValor, yLinha)
                    .lineTo(xValor + larguraValor, yLinha)
                    .lineWidth(0.5)
                    .strokeColor(COR_LINHA)
                    .stroke();
                yMaximo = Math.max(yMaximo, y + doc.currentLineHeight(true));
            }
            x += larguraColuna;
        }

        doc.x = esquerda;
        doc.y = yMaximo + 6;
    }

    // Cabeçalho
    const logo = caminhoDoLogo();
    if (logo) {
        try {
            const altura = 56;
            const larguraLogo = 80;
            doc.image(logo, esquerda + (largura - larguraLogo) / 2, doc.y, {
                fit: [larguraLogo, altura],
                align: "center",
                valign: "center",
            });
            doc.y += altura + 8;
        } catch {
            // arquivo inválido: segue sem logo
        }
    }

    doc.font(NEGRITO).fontSize(15).fillColor(COR_TEXTO);
    doc.text(TITULO_TERMO, esquerda, doc.y, { width: largura, align: "center" });
    doc.moveDown(0.8);
    paragrafo(INTRODUCAO);

    // Dados do animal (atuais)
    const { animal } = termo;
    secao("Dados do animal");
    linhaDeCampos([{ rotulo: "Nome", valor: animal.nome, fracao: 1 }]);
    linhaDeCampos([{ rotulo: "Novo nome", valor: null, fracao: 1 }]);
    linhaDeCampos([
        { rotulo: "Espécie", valor: ROTULOS_ESPECIE[animal.especie], fracao: 1 / 3 },
        { rotulo: "Porte", valor: ROTULOS_PORTE[animal.porte], fracao: 1 / 3 },
        { rotulo: "Idade", valor: textoIdade(animal.idade), fracao: 1 / 3 },
    ]);
    // linha própria: a raça pode ter até 191 caracteres
    linhaDeCampos([{ rotulo: "Raça", valor: animal.raca || "Não informada", fracao: 1 }]);
    // sexo nulo: nenhuma opção marcada
    linhaDeCampos([
        {
            rotulo: "Sexo",
            valor: `${marcador(animal.sexo === "MACHO")} Macho     ${marcador(animal.sexo === "FEMEA")} Fêmea`,
            fracao: 1,
        },
    ]);
    const dataCastracao = dataBR(animal.dataCastracao);
    linhaDeCampos([
        {
            rotulo: "Castrado",
            valor: animal.castrado ? `SIM${dataCastracao ? `, em ${dataCastracao}` : ""}` : "NÃO",
            fracao: 1,
        },
    ]);
    const vacina = animal.vacinado
        ? [
              "SIM",
              animal.dosesVacina !== null ? `${animal.dosesVacina} ${animal.dosesVacina === 1 ? "dose" : "doses"}` : null,
              animal.dataRevacinacao ? `revacinação em ${dataBR(animal.dataRevacinacao)}` : null,
          ]
              .filter(Boolean)
              .join(", ")
        : "NÃO";
    linhaDeCampos([{ rotulo: "Vacinado", valor: vacina, fracao: 1 }]);
    linhaDeCampos([{ rotulo: "Observações", valor: animal.descricao, fracao: 1 }]);

    // Dados do adotante: nome e telefone da solicitação; o resto é preenchido à mão
    const adotante = termo.solicitacao;
    secao("Dados do adotante");
    linhaDeCampos([{ rotulo: "Nome", valor: adotante?.nome ?? null, fracao: 1 }]);
    linhaDeCampos([
        { rotulo: "Telefone/WhatsApp", valor: adotante ? formatarTelefone(adotante.telefone) : null, fracao: 0.5 },
        { rotulo: "E-mail", valor: null, fracao: 0.5 },
    ]);
    linhaDeCampos([
        { rotulo: "CPF", valor: null, fracao: 0.5 },
        { rotulo: "RG", valor: null, fracao: 0.5 },
    ]);
    linhaDeCampos([{ rotulo: "Endereço completo", valor: null, fracao: 1 }]);
    linhaDeCampos([
        { rotulo: "CEP", valor: null, fracao: 0.3 },
        { rotulo: "Bairro", valor: null, fracao: 0.7 },
    ]);
    linhaDeCampos([
        { rotulo: "Cidade", valor: null, fracao: 0.7 },
        { rotulo: "Estado", valor: null, fracao: 0.3 },
    ]);

    // Cláusulas
    secao("Compromissos do adotante");
    clausulas({ castrado: animal.castrado, dataCastracao }).forEach((clausula, indice) => {
        garantirEspaco(TAMANHO * 3);
        doc.font(NEGRITO).fontSize(TAMANHO).fillColor(COR_TEXTO);
        doc.text(`CLÁUSULA ${indice + 1}ª – ${clausula.titulo.toUpperCase()}. `, esquerda, doc.y, {
            width: largura,
            align: clausula.semJustificar ? "left" : "justify",
            continued: true,
        });
        doc.font(NORMAL).text(clausula.texto);
        doc.moveDown(0.45);
    });

    doc.moveDown(0.2);
    paragrafo(DECLARACAO_FINAL, 1);

    // Fecho e assinaturas: ficam juntos na mesma página
    garantirEspaco(150);
    doc.font(NORMAL).fontSize(TAMANHO + 0.5).fillColor(COR_TEXTO);
    const cidade = opcoes.cidade ?? "______________________________";
    doc.text(`${cidade}, ____/____/______`, esquerda, doc.y, { width: largura, align: "right" });

    const espacoEntre = 40;
    const larguraAssinatura = (largura - espacoEntre) / 2;
    const yAssinatura = doc.y + 56;
    const colunas = [esquerda, esquerda + larguraAssinatura + espacoEntre];
    for (const x of colunas) {
        doc.moveTo(x, yAssinatura)
            .lineTo(x + larguraAssinatura, yAssinatura)
            .lineWidth(0.7)
            .strokeColor(COR_TEXTO)
            .stroke();
    }

    const [xAdotante, xAbrigo] = colunas as [number, number];
    doc.font(NEGRITO).fontSize(TAMANHO);
    doc.text(ROTULO_ASSINATURA_ADOTANTE, xAdotante, yAssinatura + 5, { width: larguraAssinatura, align: "center" });
    doc.text(ROTULO_ASSINATURA_ABRIGO, xAbrigo, yAssinatura + 5, { width: larguraAssinatura, align: "center" });
    doc.font(NORMAL);
    doc.text(termo.geradoPor.nome, xAbrigo, doc.y + 1, { width: larguraAssinatura, align: "center" });
    doc.text(`Telefone: ${opcoes.telefoneAbrigo ?? "______________________"}`, xAbrigo, doc.y + 1, {
        width: larguraAssinatura,
        align: "center",
    });

    // Rodapé em todas as páginas (fora da margem, então a margem inferior é zerada ao escrever)
    const [ano, mes, dia] = hoje().split("-");
    const geradoEm = `Documento gerado pelo sistema em ${dia}/${mes}/${ano}`;
    const { start, count } = doc.bufferedPageRange();
    for (let pagina = start; pagina < start + count; pagina++) {
        doc.switchToPage(pagina);
        const margemInferior = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const y = doc.page.height - 36;
        doc.font(NORMAL).fontSize(7.5).fillColor(COR_SECUNDARIA);
        doc.text(geradoEm, esquerda, y, { width: largura, align: "left", lineBreak: false });
        doc.text(`Página ${pagina - start + 1} de ${count}`, esquerda, y, { width: largura, align: "right", lineBreak: false });
        doc.page.margins.bottom = margemInferior;
    }

    doc.end();
    return pronto;
}
