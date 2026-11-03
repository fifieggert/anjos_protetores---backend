import type { Request, Response } from "express";
import { dashboardService } from "../service/dashboardService";

const service = new dashboardService();

export class dashboardController {
    // Números e listas curtas do painel da coordenação (detalhes em docs/dashboard.md).
    async resumo(_req: Request, res: Response) {
        const painel = await service.resumo();
        // dados internos: o navegador e proxies não guardam cópia
        res.set("Cache-Control", "no-store");
        return res.status(200).json(painel);
    }
}
