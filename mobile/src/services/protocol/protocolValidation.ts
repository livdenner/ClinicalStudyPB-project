import type { PlannedActivity } from './protocolTypes';

/** Verifica se o valor é um inteiro positivo seguro para IDs e posições do contrato. */
export function isPositiveSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  );
}

/**
 * Converte parâmetro numérico de rota em inteiro positivo seguro, devolvendo
 * `null` quando ausente, não numérico ou fora do intervalo seguro.
 */
export function parseRoutePositiveId(
  value: string | string[] | null | undefined,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || !/^[0-9]+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);
  return isPositiveSafeInteger(parsed) ? parsed : null;
}

/** Verifica se o valor recebido do JSON é uma string (inclusive vazia). */
export function isNonNullableString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Verifica um registro opcional de data/texto no JSON, aceitando campo ausente
 * (`undefined`), `null` ou string válida.
 */
export function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

/**
 * Valida em tempo de execução uma atividade prevista do protocolo recebida em
 * `/api/me/studies` ou `/api/me/visits`.
 */
export function isPlannedActivity(value: unknown): value is PlannedActivity {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    isPositiveSafeInteger(record.id) &&
    isNonNullableString(record.name) &&
    isNonNullableString(record.description) &&
    isPositiveSafeInteger(record.position)
  );
}
