import { apiRequest } from '../api/apiClient';
import { bearerHeader } from '../api/authorization';
import type {
  InvitationDecision,
  InvitationDecisionRequest,
  StudyInvitation,
  StudyInvitationSummary,
  VisibleInvitationStatus,
} from './invitationTypes';

// A URL base configurada já termina em `/api`; os caminhos são relativos a ela.
const INVITATIONS_PATH = 'me/invitations';

function candidatePath(candidateId: number): string {
  if (!Number.isSafeInteger(candidateId) || candidateId <= 0) {
    throw new Error('Identificador de convite inválido.');
  }
  return `${INVITATIONS_PATH}/${candidateId}`;
}

/**
 * Lista os convites visíveis da conta autenticada.
 *
 * @param accessToken Token da sessão participante.
 * @param options Filtro opcional de situação e sinal para cancelar a consulta.
 * @returns Convites da candidatura mais recente para a mais antiga.
 */
export async function listInvitations(
  accessToken: string,
  options: {
    status?: VisibleInvitationStatus;
    signal?: AbortSignal;
  } = {},
): Promise<StudyInvitationSummary[]> {
  const query = options.status ? `?status=${options.status}` : '';

  return apiRequest<StudyInvitationSummary[]>(`${INVITATIONS_PATH}${query}`, {
    headers: bearerHeader(accessToken),
    signal: options.signal,
  });
}

/**
 * Consulta o detalhe de um convite pelo identificador da candidatura.
 * A rota usa `candidateId`; `studyId` e `userId` são identificadores distintos.
 *
 * @param candidateId Candidatura exibida na lista.
 * @param accessToken Token da sessão participante.
 * @param signal Sinal opcional para cancelar a consulta ao desmontar ou trocar de convite.
 * @returns Estudo, protocolo e termo simulado autorizados para a conta.
 */
export async function getInvitation(
  candidateId: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<StudyInvitation> {
  return apiRequest<StudyInvitation>(candidatePath(candidateId), {
    headers: bearerHeader(accessToken),
    signal,
  });
}

/**
 * Registra a decisão única de aceite ou recusa do termo simulado.
 *
 * @param candidateId Candidatura que receberá a decisão.
 * @param decision `GRANTED` para aceite ou `DECLINED` para recusa.
 * @param accessToken Token da sessão participante.
 * @returns Convite atualizado com a situação gravada pelo servidor.
 */
export async function decideInvitation(
  candidateId: number,
  decision: InvitationDecision,
  accessToken: string,
): Promise<StudyInvitation> {
  const body: InvitationDecisionRequest = { status: decision };

  return apiRequest<StudyInvitation>(`${candidatePath(candidateId)}/decision`, {
    method: 'POST',
    headers: bearerHeader(accessToken),
    body,
  });
}
