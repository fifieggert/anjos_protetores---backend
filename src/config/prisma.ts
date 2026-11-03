import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { opcoesConexaoBanco } from "../utils/conexaoBanco";

// Host, usuário, TLS e prazos de conexão saem da DATABASE_URL (ver utils/conexaoBanco.ts).
const adapter = new PrismaMariaDb(opcoesConexaoBanco(process.env["DATABASE_URL"]));
const prisma = new PrismaClient({ adapter });

export default prisma;
