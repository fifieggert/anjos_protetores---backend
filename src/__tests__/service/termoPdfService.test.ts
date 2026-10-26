import fs from "node:fs";
import PDFDocument from "pdfkit";
import { describe, expect, it, vi } from "vitest";
import { gerarTermoPdf, nomeArquivoTermo } from "../../service/termoPdfService";
import { clausulas } from "../../service/termoTexto";
import type { TermoParaPdf } from "../../repository/termoAdocaoRepository";

const opcoes = { cidade: "Blumenau/SC", telefoneAbrigo: "(47) 3333-4444" };

function termo(animal: Partial<TermoParaPdf["animal"]> = {}, solicitacao: TermoParaPdf["solicitacao"] = null): TermoParaPdf {
    return {
        id: "t1",
        geradoEm: new Date("2026-10-25T15:00:00.000Z"),
        animal: {
            nome: "Rex",
            especie: "CACHORRO",
            raca: null,
            idade: null,
            porte: "MEDIO",
            sexo: null,
            castrado: false,
            dataCastracao: null,
            vacinado: false,
            dosesVacina: null,
            dataRevacinacao: null,
            descricao: null,
            ...animal,
        },
        solicitacao,
        geradoPor: { nome: "Coordenadora" },
    };
}

// Todo texto escrito no PDF (o conteúdo do arquivo é comprimido, então lemos as chamadas).
function capturarTextos() {
    const textos: string[] = [];
    const original = PDFDocument.prototype.text;
    vi.spyOn(PDFDocument.prototype, "text").mockImplementation(function (this: PDFKit.PDFDocument, ...args: unknown[]) {
        if (typeof args[0] === "string") textos.push(args[0]);
        return (original as (...a: unknown[]) => PDFKit.PDFDocument).apply(this, args);
    });
    return () => textos.join("\n");
}

describe("gerarTermoPdf", () => {
    it("gera um Buffer de PDF válido (começa com %PDF-)", async () => {
        const pdf = await gerarTermoPdf(termo(), opcoes);
        expect(Buffer.isBuffer(pdf)).toBe(true);
        expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
        expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");
    });

    it("preenche os dados do animal, do adotante e o rodapé com a data de hoje", async () => {
        const texto = capturarTextos();
        await gerarTermoPdf(
            termo(
                {
                    raca: "SRD",
                    idade: 1,
                    sexo: "FEMEA",
                    castrado: true,
                    // como o frontend envia: o dia ao meio-dia de Brasília
                    dataCastracao: new Date("2026-03-10T15:00:00.000Z"),
                    vacinado: true,
                    dosesVacina: 1,
                    dataRevacinacao: new Date("2027-03-10T12:00:00.000Z"),
                    descricao: "Dócil",
                },
                { nome: "Ana Maria", telefone: "47999998888" },
            ),
            opcoes,
        );
        const conteudo = texto();

        expect(conteudo).toContain("Ana Maria");
        expect(conteudo).toContain("(47) 99999-8888");
        expect(conteudo).toContain("1 ano");
        expect(conteudo).toContain("(    ) Macho     ( X ) Fêmea");
        expect(conteudo).toContain("SIM, em 10/03/2026");
        expect(conteudo).toContain("SIM, 1 dose, revacinação em 10/03/2027");
        expect(conteudo).toContain("O animal já foi castrado em 10/03/2026.");
        expect(conteudo).toContain("Blumenau/SC, ____/____/______");
        expect(conteudo).toContain("Telefone: (47) 3333-4444");
        expect(conteudo).toContain("Coordenadora");
        expect(conteudo).toContain("Documento gerado pelo sistema em 25/10/2026");
        expect(conteudo).toMatch(/Página 1 de \d/);
    });

    it("sem castração, a cláusula exige castrar; sem cidade e telefone, deixa linhas em branco", async () => {
        const texto = capturarTextos();
        await gerarTermoPdf(termo({ idade: 3, vacinado: true, dosesVacina: 2 }), { cidade: null, telefoneAbrigo: null });
        const conteudo = texto();

        expect(conteudo).toContain("providenciará a castração");
        expect(conteudo).toContain("NÃO");
        expect(conteudo).toContain("SIM, 2 doses");
        expect(conteudo).toContain("3 anos");
        expect(conteudo).toContain("Não informada");
        expect(conteudo).toContain("______________________________, ____/____/______");
        expect(conteudo).toContain("Telefone: ______________________");
    });

    // "AAAA-MM-DD" enviado direto à API é gravado à meia-noite UTC; o frontend envia o dia
    // ao meio-dia de Brasília. Nos dois casos o PDF mostra o mesmo dia, qualquer que seja o
    // fuso da máquina. O rodapé (data de geração) continua no fuso de Brasília.
    it.each(["UTC", "America/Sao_Paulo", "Asia/Tokyo", "Pacific/Honolulu"])(
        "datas de castração e revacinação saem no dia gravado com TZ=%s",
        async (fuso) => {
            const fusoOriginal = process.env["TZ"];
            process.env["TZ"] = fuso;
            try {
                // 01:30 UTC de 26/10 ainda é 25/10 em Brasília: o rodapé não muda para 26
                vi.setSystemTime(new Date("2026-10-26T01:30:00.000Z"));
                for (const dataCastracao of [new Date("2026-03-10T00:00:00.000Z"), new Date("2026-03-10T15:00:00.000Z")]) {
                    const texto = capturarTextos();
                    await gerarTermoPdf(
                        termo({
                            castrado: true,
                            dataCastracao,
                            vacinado: true,
                            dataRevacinacao: new Date("2027-01-01T00:00:00.000Z"),
                        }),
                        opcoes,
                    );
                    const conteudo = texto();
                    expect(conteudo).toContain("O animal já foi castrado em 10/03/2026.");
                    expect(conteudo).toContain("SIM, em 10/03/2026");
                    expect(conteudo).toContain("revacinação em 01/01/2027");
                    expect(conteudo).toContain("Documento gerado pelo sistema em 25/10/2026");
                    vi.restoreAllMocks();
                }
            } finally {
                process.env["TZ"] = fusoOriginal;
            }
        },
    );

    it("telefone fora do formato sai como está", async () => {
        const texto = capturarTextos();
        await gerarTermoPdf(termo({}, { nome: "Ana", telefone: "123" }), opcoes);
        expect(texto()).toContain("123");
    });

    it("sem o arquivo do logo, gera o PDF mesmo assim", async () => {
        vi.spyOn(fs, "existsSync").mockReturnValue(false);
        const imagem = vi.spyOn(PDFDocument.prototype, "image");
        const pdf = await gerarTermoPdf(termo(), opcoes);
        expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
        expect(imagem).not.toHaveBeenCalled();
    });

    it("logo inválido não impede a geração", async () => {
        vi.spyOn(PDFDocument.prototype, "image").mockImplementation(() => {
            throw new Error("imagem corrompida");
        });
        const pdf = await gerarTermoPdf(termo(), opcoes);
        expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    });
});

describe("clausulas (termoTexto)", () => {
    const castracao = (contexto: Parameters<typeof clausulas>[0]) =>
        clausulas(contexto).find((c) => c.titulo === "Castração")?.texto;

    it("animal castrado com data: informa a data", () => {
        expect(castracao({ castrado: true, dataCastracao: "10/03/2026" })).toBe("O animal já foi castrado em 10/03/2026.");
    });

    it("animal castrado sem data", () => {
        expect(castracao({ castrado: true, dataCastracao: null })).toBe("O animal já foi castrado.");
    });

    it("animal não castrado: o adotante se compromete a castrar", () => {
        expect(castracao({ castrado: false, dataCastracao: null })).toMatch(/^O ADOTANTE providenciará a castração/);
    });

    it("mantém 11 cláusulas, com a de castração na 4ª posição", () => {
        const lista = clausulas({ castrado: false, dataCastracao: null });
        expect(lista).toHaveLength(11);
        expect(lista[3]?.titulo).toBe("Castração");
    });
});

describe("nomeArquivoTermo", () => {
    it.each([
        ["Açúcar Mascavo!", "termo-adocao-acucar-mascavo.pdf"],
        ["  --Totó--  ", "termo-adocao-toto.pdf"],
        ["名前", "termo-adocao-animal.pdf"],
        ["", "termo-adocao-animal.pdf"],
        ['Rex "o bravo"; rm -rf', "termo-adocao-rex-o-bravo-rm-rf.pdf"],
    ])("%s -> %s", (nome, esperado) => {
        expect(nomeArquivoTermo(nome)).toBe(esperado);
    });

    it("limita a 60 caracteres sem terminar em hífen", () => {
        const nome = nomeArquivoTermo(`${"a".repeat(59)} b`);
        expect(nome).toBe(`termo-adocao-${"a".repeat(59)}.pdf`);
    });
});
