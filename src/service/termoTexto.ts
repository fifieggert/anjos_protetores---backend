// Texto do termo de adoção. PROVISÓRIO: será revisado por alguém da área jurídica.
// Edite aqui à vontade; a montagem do PDF fica em termoPdfService.ts.
// A fonte do PDF (Helvetica) aceita acentos, "ª" e "º", mas não emojis nem aspas
// tipográficas fora do padrão Windows-1252.

export const NOME_ABRIGO = "Anjos Protetores";

// Caixa para marcar à mão. Espaços não separáveis para a caixa não quebrar entre linhas;
// a cláusula que usa caixas vai com semJustificar (o justificado as deixaria estreitas).
const CAIXA = "(\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0)";

export const TITULO_TERMO = "TERMO DE ADOÇÃO RESPONSÁVEL";

export const INTRODUCAO =
    `Pelo presente termo, o(a) ADOTANTE identificado(a) abaixo recebe do abrigo ${NOME_ABRIGO} ` +
    "o animal descrito a seguir e assume, de forma livre e consciente, os compromissos deste documento.";

export interface Clausula {
    titulo: string;
    texto: string;
    // true quando o texto tem caixas para marcar: o alinhamento justificado as estreita
    semJustificar?: boolean;
}

export interface ContextoClausulas {
    castrado: boolean;
    // DD/MM/AAAA, quando informada
    dataCastracao: string | null;
}

// Cláusula 4: muda conforme o animal já ser castrado ou não.
function clausulaCastracao({ castrado, dataCastracao }: ContextoClausulas): Clausula {
    if (castrado) {
        return {
            titulo: "Castração",
            texto: dataCastracao
                ? `O animal já foi castrado em ${dataCastracao}.`
                : "O animal já foi castrado.",
        };
    }
    return {
        titulo: "Castração",
        texto:
            "O ADOTANTE providenciará a castração do animal por médico-veterinário habilitado até que ele " +
            "complete 6 (seis) meses de vida ou, se já tiver mais de 6 (seis) meses, em até 6 (seis) meses " +
            `contados da adoção, e apresentará ao abrigo ${NOME_ABRIGO} o comprovante do procedimento. ` +
            "O prazo só poderá ser prorrogado se houver impedimento de saúde atestado por médico-veterinário.",
    };
}

// Cláusulas na ordem em que aparecem; a numeração (1ª, 2ª...) é feita no PDF.
export function clausulas(contexto: ContextoClausulas): Clausula[] {
    return [
        {
            titulo: "Cuidados",
            texto:
                "O ADOTANTE declara conhecer os riscos e as necessidades próprias da espécie e da raça do animal " +
                "e se compromete a mantê-lo em ambiente seguro, com alimentação, água limpa, higiene, abrigo e " +
                "espaço adequados; a não mantê-lo confinado em espaço pequeno nem preso por correntes; a " +
                "proporcionar passeios diários, no caso de cães; e a levá-lo ao médico-veterinário sempre que " +
                "necessário e, no mínimo, uma vez por ano.",
        },
        {
            titulo: "Acompanhamento",
            texto:
                `O ADOTANTE enviará fotos e vídeos do animal sempre que o abrigo ${NOME_ABRIGO} solicitar e ` +
                "permitirá visitas ao local onde ele vive, combinadas com antecedência, para que o abrigo " +
                "verifique suas condições.",
        },
        {
            titulo: "Proibições",
            texto:
                "O ADOTANTE não deixará o animal circular sozinho fora dos limites da residência e não o " +
                "abandonará, trocará, venderá, doará ou cederá a terceiros. Se não puder mais ficar com ele, " +
                `avisará o abrigo ${NOME_ABRIGO}, que o receberá de volta.`,
        },
        clausulaCastracao(contexto),
        {
            titulo: "Uso vedado",
            texto:
                "É proibido usar o animal para reprodução, rinhas, pesquisas, rituais ou qualquer forma de " +
                "maus-tratos ou mutilação. O ADOTANTE está ciente de que maus-tratos a animais são crime " +
                "(art. 32 da Lei nº 9.605/1998).",
        },
        {
            titulo: "Eutanásia",
            texto:
                "O ADOTANTE não promoverá nem permitirá que a vida do animal seja interrompida, salvo por " +
                "indicação de médico-veterinário, comprovada por laudo.",
        },
        {
            titulo: "Comunicação ao abrigo",
            texto:
                `O ADOTANTE avisará o abrigo ${NOME_ABRIGO} em caso de fuga, doença grave ou falecimento do ` +
                "animal, comprovando o falecimento com documento veterinário quando houver. Em caso de fuga, " +
                "esgotará todos os meios de busca ao seu alcance.",
        },
        {
            titulo: "Adaptação e devolução",
            texto:
                "O ADOTANTE reservará pelo menos 15 (quinze) dias para a adaptação do animal ao novo lar. Se, " +
                "depois desse prazo, a devolução for inevitável, ela deverá ser justificada ao abrigo, e os " +
                "custos de transporte da devolução ficarão por conta do ADOTANTE.",
        },
        {
            titulo: "Imagem",
            semJustificar: true,
            texto:
                `Autorizo ${CAIXA} / Não autorizo ${CAIXA} a divulgação da minha imagem e da do animal nas redes ` +
                `sociais do abrigo ${NOME_ABRIGO}.`,
        },
        {
            titulo: "Dados pessoais",
            texto:
                "Os dados pessoais informados neste termo serão usados apenas para o registro da adoção e para " +
                `o contato do abrigo ${NOME_ABRIGO} com o ADOTANTE.`,
        },
        {
            titulo: "Vigência",
            texto: "Este termo passa a valer a partir da data de sua assinatura.",
        },
    ];
}

export const DECLARACAO_FINAL =
    `O ADOTANTE declara estar ciente de que o abrigo ${NOME_ABRIGO} não pode garantir a saúde, o ` +
    "temperamento ou o tempo de vida do animal, pois nem sempre há informações sobre seu histórico " +
    "clínico e sua origem.";

export const ROTULO_ASSINATURA_ADOTANTE = "ADOTANTE";
export const ROTULO_ASSINATURA_ABRIGO = "RESPONSÁVEL PELO ABRIGO";
