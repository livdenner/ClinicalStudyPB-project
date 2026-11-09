import type { ApiFieldError } from "./api";

export type { ApiFieldError } from "./api";

export type UserRole = "RESEARCHER" | "COORDINATOR" | "ADMINISTRATOR" | "PARTICIPANT";

export type AuthenticatedUser = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    active: boolean;
};

export type LoginRequest = {
    email: string;
    password: string;
};

export type LoginResponse = {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    user: AuthenticatedUser;
};

export type AuthSession = {
    accessToken: string;
    tokenType: string;
    expiresAt: number;
    user: AuthenticatedUser;
};

export type ApiErrorResponse = {
    code?: string;
    message?: string;
    fieldErrors?: ApiFieldError[];
};

export const ROLE_LABELS: Record<UserRole, string> = {
    RESEARCHER: "Pesquisador",
    COORDINATOR: "Coordenador",
    ADMINISTRATOR: "Administrador",
    PARTICIPANT: "Participante",
};
