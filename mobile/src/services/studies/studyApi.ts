import { apiRequest } from '../api/apiClient';
import { bearerHeader } from '../api/authorization';
import type { ParticipantStudy } from './studyTypes';

// A URL base configurada já termina em `/api`; os caminhos são relativos a ela.
const STUDIES_PATH = 'me/studies';

/**
 * Erro disparado quando a resposta de `/me/studies` não segue o formato de
 * array esperado ou omite campos obrigatórios, evitando mascarar falha de
 * contrato como lista vazia ou protocolo sem visitas.
 */
export class InvalidStudiesResponseError extends Error {
  constructor() {
    super('Resposta inválida ao consultar os estudos do participante.');
    this.name = 'InvalidStudiesResponseError';
  }
}

function isPositiveSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  );
}

function isNonNullableString(value: unknown): value is string {
  return typeof value === 'string';
}

function isParticipantStudy(value: unknown): value is ParticipantStudy {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const validWithdrawnAt =
    record.withdrawnAt === undefined ||
    record.withdrawnAt === null ||
    typeof record.withdrawnAt === 'string';

  return (
    isPositiveSafeInteger(record.participantId) &&
    isPositiveSafeInteger(record.studyId) &&
    isNonNullableString(record.studyTitle) &&
    isNonNullableString(record.studyObjective) &&
    isNonNullableString(record.studyStatus) &&
    isNonNullableString(record.startDate) &&
    isNonNullableString(record.endDate) &&
    isNonNullableString(record.responsibleName) &&
    isNonNullableString(record.participationStatus) &&
    isNonNullableString(record.includedAt) &&
    validWithdrawnAt &&
    Array.isArray(record.plannedVisits)
  );
}

/**
 * Lista os estudos em que a conta autenticada participa. A identidade vem
 * exclusivamente do token enviado no cabeçalho `Authorization`.
 *
 * @param accessToken Token da sessão participante.
 * @param signal Sinal opcional para cancelar a consulta ao perder foco ou sair.
 * @returns Participações ativas e retiradas, na ordem devolvida pelo servidor.
 */
export async function listMyStudies(
  accessToken: string,
  signal?: AbortSignal,
): Promise<ParticipantStudy[]> {
  const response = await apiRequest<unknown>(STUDIES_PATH, {
    headers: bearerHeader(accessToken),
    signal,
  });

  if (!Array.isArray(response) || !response.every(isParticipantStudy)) {
    throw new InvalidStudiesResponseError();
  }

  return response;
}
