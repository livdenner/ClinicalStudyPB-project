import { apiRequest } from '../api/apiClient';
import { bearerHeader } from '../api/authorization';
import {
  isNonNullableString,
  isOptionalString,
  isPlannedActivity,
  isPositiveSafeInteger,
} from '../protocol/protocolValidation';
import type { ParticipantVisit, ParticipantVisits } from './visitTypes';

// A URL base configurada já termina em `/api`; os caminhos são relativos a ela.
const VISITS_PATH = 'me/visits';

/**
 * Erro disparado quando a resposta de `/me/visits` não segue o formato esperado
 * ou omite campos obrigatórios, evitando mascarar falha de contrato como ausência
 * de agendamentos ou histórico vazio.
 */
export class InvalidVisitsResponseError extends Error {
  constructor() {
    super('Resposta inválida ao consultar as visitas do participante.');
    this.name = 'InvalidVisitsResponseError';
  }
}

function isParticipantVisit(value: unknown): value is ParticipantVisit {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    isPositiveSafeInteger(record.id) &&
    isPositiveSafeInteger(record.studyId) &&
    isNonNullableString(record.studyTitle) &&
    isPositiveSafeInteger(record.participantId) &&
    isPositiveSafeInteger(record.plannedVisitId) &&
    isNonNullableString(record.plannedVisitName) &&
    isNonNullableString(record.scheduledAt) &&
    isNonNullableString(record.status) &&
    isOptionalString(record.outcomeAt) &&
    isOptionalString(record.cancellationReason) &&
    Array.isArray(record.activities) &&
    record.activities.every(isPlannedActivity)
  );
}

function isParticipantVisitsResponse(
  value: unknown,
): value is ParticipantVisits {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.upcoming) &&
    record.upcoming.every(isParticipantVisit) &&
    Array.isArray(record.history) &&
    record.history.every(isParticipantVisit)
  );
}

/**
 * Consulta as próximas visitas (`SCHEDULED`) e o histórico de desfechos
 * (`DONE`, `ABSENT`, `CANCELLED`) da conta autenticada em `GET /api/me/visits`.
 * A identidade vem exclusivamente do token enviado em `Authorization`.
 *
 * @param accessToken Token da sessão participante.
 * @param signal Sinal opcional para cancelar a consulta ao perder foco ou sair.
 * @returns Próximas visitas e histórico já separados pelo servidor.
 */
export async function getMyVisits(
  accessToken: string,
  signal?: AbortSignal,
): Promise<ParticipantVisits> {
  const response = await apiRequest<unknown>(VISITS_PATH, {
    headers: bearerHeader(accessToken),
    signal,
  });

  if (!isParticipantVisitsResponse(response)) {
    throw new InvalidVisitsResponseError();
  }

  return response;
}
