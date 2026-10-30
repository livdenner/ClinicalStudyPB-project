import { Button } from "@heroui/react";
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getDefaultRouteForRole } from "../config/navigation";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../types/auth";

export function ForbiddenPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const rotaInicial = getDefaultRouteForRole(user?.role);
    const temAreaWebPermitida =
        user?.role && user.role !== "PARTICIPANT" && rotaInicial !== "/acesso-negado";

    async function handleTrocarConta() {
        await logout();
        navigate("/login", { replace: true });
    }

    return (
        <section
            className="flex min-h-[calc(100vh-104px)] flex-col items-center justify-center px-6 py-10 text-center"
            aria-labelledby="forbidden-title"
        >
            <ShieldAlert
                aria-hidden="true"
                className="mb-4 h-12 w-12 text-red-600"
                strokeWidth={1.6}
            />

            <p className="m-0 text-sm font-bold tracking-[0.12em] text-red-600">403</p>

            <h1
                id="forbidden-title"
                className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[var(--color-text)]"
            >
                Acesso negado
            </h1>

            <p className="mt-[9px] max-w-[460px] text-[13px] leading-[1.65] text-[var(--color-muted)]">
                {user
                    ? `Seu perfil (${ROLE_LABELS[user.role] ?? user.role}) não possui permissão para acessar esta área.`
                    : "Você não possui permissão para acessar este recurso."}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {temAreaWebPermitida && (
                    <Button
                        variant="primary"
                        onPress={() => navigate(rotaInicial, { replace: true })}
                    >
                        Ir para minha área inicial
                    </Button>
                )}

                <Button
                    variant="secondary"
                    onPress={handleTrocarConta}
                    className="border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[#EFEFF0]"
                >
                    Entrar com outra conta
                </Button>
            </div>
        </section>
    );
}
