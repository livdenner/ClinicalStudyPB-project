import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Maior atraso aceito por `setTimeout` sem estouro de sinal. Prazos maiores
 * são reagendados em etapas até o vencimento.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** Opções do acompanhamento do vencimento absoluto da sessão. */
export interface SessionExpirationOptions {
  /** Instante absoluto de vencimento em milissegundos, ou `null` sem sessão. */
  expiresAt: number | null;
  /** Chamado uma única vez quando o prazo é alcançado. */
  onExpire(): void;
}

/**
 * Calcula quanto falta para o vencimento, sem devolver valores negativos.
 *
 * @param expiresAt Instante absoluto de vencimento em milissegundos.
 * @param now Instante atual em milissegundos.
 */
export function millisecondsUntilExpiration(
  expiresAt: number,
  now: number,
): number {
  const remaining = expiresAt - now;
  return Number.isFinite(remaining) && remaining > 0 ? remaining : 0;
}

/**
 * Encerra a sessão no instante absoluto de vencimento e verifica o prazo
 * sempre que o aplicativo volta ao primeiro plano. O timer e o listener são
 * removidos ao trocar de sessão, sair ou desmontar.
 *
 * `onExpire` é lido por referência para que a troca de callbacks não reinicie
 * o timer a cada renderização.
 */
export function useSessionExpiration({
  expiresAt,
  onExpire,
}: SessionExpirationOptions): void {
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (expiresAt === null) {
      return;
    }

    const deadline = expiresAt;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function clearTimer(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function expireIfNeeded(): boolean {
      if (Date.now() >= deadline) {
        clearTimer();
        onExpireRef.current();
        return true;
      }
      return false;
    }

    function schedule(): void {
      clearTimer();
      if (expireIfNeeded()) {
        return;
      }

      const remaining = deadline - Date.now();
      timer = setTimeout(
        schedule,
        Math.min(remaining + 1, MAX_TIMEOUT_MS),
      );
    }

    schedule();

    const subscription = AppState.addEventListener(
      'change',
      (status: AppStateStatus) => {
        if (status === 'active') {
          // O sistema pode suspender timers em segundo plano; ao voltar,
          // o prazo absoluto é conferido e o timer, reagendado.
          schedule();
        }
      },
    );

    return () => {
      clearTimer();
      // Em testes e em implementações antigas do React Native, o listener
      // pode não devolver uma assinatura removível.
      subscription?.remove();
    };
  }, [expiresAt]);
}
