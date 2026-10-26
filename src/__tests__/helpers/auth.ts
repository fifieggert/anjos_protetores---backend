import jwt from "jsonwebtoken";
import type { PerfilUsuario } from "@prisma/client";

export const ID_ADMIN = "11111111-1111-4111-8111-111111111111";
export const ID_VOLUNTARIO = "22222222-2222-4222-8222-222222222222";
export const ID_OUTRO = "33333333-3333-4333-8333-333333333333";

export function token(perfil: PerfilUsuario, id = perfil === "ADMIN" ? ID_ADMIN : ID_VOLUNTARIO) {
    return jwt.sign({ id, perfil }, process.env["JWT_SECRET"] as string, { expiresIn: "30m" });
}

export const comoAdmin = () => `Bearer ${token("ADMIN")}`;
export const comoVoluntario = () => `Bearer ${token("VOLUNTARIO")}`;
