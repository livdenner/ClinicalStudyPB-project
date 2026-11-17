import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    AUTH_STORAGE_KEY,
    clearStoredSession,
    getAuthorizationHeader,
    loadStoredSession,
    saveStoredSession,
} from "./auth";
import type { LoginResponse } from "../types/auth";

const resposta: LoginResponse = {
    accessToken: "token-desta-aba",
    tokenType: "Bearer",
    expiresIn: 3600,
    user: {
        id: 7,
        name: "Coordenador",
        email: "coordenador@example.test",
        role: "COORDINATOR",
        active: true,
    },
};
beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});
afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
});

it("persiste token e usuário apenas na sessão da aba e recupera a sessão após recarga", () => {
    const sessao = saveStoredSession(resposta, 1000);
    expect(JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY)!)).toEqual(sessao);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(loadStoredSession(2000)).toEqual(sessao);
});

it("descarta a sessão antiga compartilhada sem autenticar a aba com ela", () => {
    localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ ...resposta, expiresAt: Date.now() + 3600000 })
    );
    localStorage.setItem("preferencia", "preservar");
    expect(loadStoredSession()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("preferencia")).toBe("preservar");
});

it("remove a sessão legada ao salvar um novo login", () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "token-antigo");
    saveStoredSession(resposta);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
});

it("limpa somente a chave de autenticação no logout", () => {
    saveStoredSession(resposta);
    sessionStorage.setItem("preferencia", "preservar");
    clearStoredSession();
    expect(loadStoredSession()).toBeNull();
    expect(sessionStorage.getItem("preferencia")).toBe("preservar");
    expect(getAuthorizationHeader()).toEqual({});
});

it.each(["{json-invalido", JSON.stringify({ accessToken: "incompleto" })])(
    "descarta sessão inválida sem quebrar o login",
    (raw) => {
        sessionStorage.setItem(AUTH_STORAGE_KEY, raw);
        expect(loadStoredSession()).toBeNull();
        expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    }
);

it("expiração remove apenas a sessão da aba", () => {
    saveStoredSession({ ...resposta, expiresIn: 1 }, 1000);
    expect(loadStoredSession(2000)).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
});

it("localStorage bloqueado não impede carregar a sessão da aba", () => {
    saveStoredSession(resposta);
    const remover = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, chave) {
        if (this === localStorage) throw new DOMException("Bloqueado", "SecurityError");
        return remover.call(this, chave);
    });
    expect(loadStoredSession()?.accessToken).toBe(resposta.accessToken);
});
