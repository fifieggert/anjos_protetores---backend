import "dotenv/config";
import app from "./app";

const PORT = process.env["PORT"] ? Number(process.env["PORT"]) : 4000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
