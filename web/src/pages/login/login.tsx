import { useState, type FormEvent } from "react";
import { Button, Input } from "@heroui/react";
import { AlertCircle, LogIn } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.svg";
import {
  canRoleAccessPath,
  getDefaultRouteForRole,
} from "../../config/navigation";
import { useAuth } from "../../context/AuthContext";
import { AuthApiError } from "../../services/auth";

type LocationState = {
  from?: string;
};

export function LoginPage() {
  const {
    isAuthenticated,
    user,
    login,
    sessionExpiredMessage,
    clearSessionExpiredMessage,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const rotaOrigem = (location.state as LocationState | null)?.from;

  if (isAuthenticated && user) {
    const destinoAutenticado =
      rotaOrigem && canRoleAccessPath(user.role, rotaOrigem)
        ? rotaOrigem
        : getDefaultRouteForRole(user.role);
    return <Navigate to={destinoAutenticado} replace />;
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    clearSessionExpiredMessage();

    const emailLimpo = email.trim();
    if (!emailLimpo || !password) {
      setErro("Informe seu e-mail e sua senha para entrar.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      setErro("Informe um endereço de e-mail válido.");
      return;
    }

    setErro("");
    setEnviando(true);

    try {
      const usuarioAutenticado = await login(emailLimpo, password);
      const destino =
        rotaOrigem && canRoleAccessPath(usuarioAutenticado.role, rotaOrigem)
          ? rotaOrigem
          : getDefaultRouteForRole(usuarioAutenticado.role);
      navigate(destino, { replace: true });
    } catch (error) {
      if (error instanceof AuthApiError) {
        setErro(error.message);
      } else {
        setErro("Não foi possível autenticar. Tente novamente.");
      }
    } finally {
      setEnviando(false);
    }
  }

  const mensagemAlerta = erro || sessionExpiredMessage;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F3F6F9] px-4 py-10">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-[420px] rounded-2xl border border-[var(--color-border)] bg-white p-8 shadow-sm"
      >
        <header className="flex flex-col items-center text-center">
          <img
            src={logo}
            alt="ClinicalStudyPB"
            className="h-10 w-[184px] object-contain"
          />

          <h1
            id="login-heading"
            className="mt-6 text-2xl font-bold tracking-tight text-[var(--color-title)]"
          >
            Acesso ao sistema
          </h1>

          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
            Entre com suas credenciais institucionais para acessar o painel.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-email"
              className="text-sm font-medium text-[var(--color-text)]"
            >
              E-mail *
            </label>

            <Input
              id="login-email"
              aria-label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="nome@clinicalstudypb.test"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              disabled={enviando}
              className="h-10 text-sm text-[var(--color-text)] focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-password"
              className="text-sm font-medium text-[var(--color-text)]"
            >
              Senha *
            </label>

            <Input
              id="login-password"
              aria-label="Senha"
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              disabled={enviando}
              className="h-10 text-sm text-[var(--color-text)] focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]"
            />
          </div>

          {mensagemAlerta && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-600"
                aria-hidden="true"
              />
              <span>{mensagemAlerta}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            isDisabled={enviando}
            className="mt-2 h-10 w-full font-semibold"
          >
            <LogIn size={18} strokeWidth={1.8} aria-hidden="true" />
            {enviando ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
