import { useSyncExternalStore } from "react";

const consulta = "(max-width: 760px)";
function assinar(atualizar: () => void) {
    if (typeof window.matchMedia !== "function") return () => {};
    const media = window.matchMedia(consulta);
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
}
function ler() {
    return typeof window.matchMedia === "function" && window.matchMedia(consulta).matches;
}

export function useTelaEstreita() {
    return useSyncExternalStore(assinar, ler, () => false);
}
