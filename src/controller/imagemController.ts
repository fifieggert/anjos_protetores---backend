import type { Request, Response } from "express";
import { imagemService } from "../service/imagemService";
import { AppError } from "../utils/AppError";
import { CAMPO_ARQUIVO } from "../middleware/uploadImagem";

const service = new imagemService();

export class imagemController {
    async upload(req: Request, res: Response) {
        if (!req.file) {
            throw new AppError(400, `Nenhum arquivo enviado. Envie a imagem no campo "${CAMPO_ARQUIVO}".`);
        }
        const { url } = await service.salvar(req.file.buffer);
        return res.status(201).location(url).json({ url });
    }

    // Pública: a página do abrigo mostra as fotos para os visitantes.
    async ler(req: Request, res: Response) {
        const imagem = await service.ler(req.params["arquivo"] as string);
        if (!imagem) {
            return res.status(404).json({ error: "Imagem não encontrada." });
        }

        res.set({
            "Content-Type": imagem.tipoMime,
            "Content-Length": String(imagem.conteudo.length),
            "X-Content-Type-Options": "nosniff",
            // o nome é aleatório e o conteúdo nunca muda: o navegador pode guardar por 1 ano
            "Cache-Control": "public, max-age=31536000, immutable",
            // o helmet manda same-origin; só aqui liberamos para o frontend em outra origem
            // (ex.: localhost:5173 no desenvolvimento) conseguir exibir a imagem
            "Cross-Origin-Resource-Policy": "cross-origin",
        });
        return res.status(200).send(imagem.conteudo);
    }
}
