import { ApiError } from '../api/apiClient';
import { InvalidStudiesResponseError } from './studyApi';

/** Mensagens dos estudos; nenhuma expõe dados privados ou detalhes internos. */
export const STUDY_MESSAGES = {
  listFailed:
    'Não foi possível carregar seus estudos. Verifique sua conexão e tente novamente.',
  forbidden: 'Sua conta não tem permissão para consultar estudos.',
  serviceUnavailable:
    'O serviço está indisponível no momento. Tente novamente.',
  invalidResponse:
    'Não foi possível ler os dados dos seus estudos. Tente novamente.',
  previousData:
    'Os estudos exibidos são de uma consulta anterior e podem estar desatualizados.',
  empty:
    'Você ainda não foi incluído em um estudo. A inclusão é realizada pela coordenação após as etapas necessárias.',
} as const;

/**
 * Traduz um erro ao carregar estudos em uma mensagem segura. Usa apenas a
 * classe do erro e o status HTTP, nunca textos crus devolvidos pela API.
 *
 * @param error Erro lançado pelo cliente HTTP, parser ou rede.
 * @returns Mensagem pronta para exibição na tela.
 */
export function getStudyLoadErrorMessage(error: unknown): string {
  if (error instanceof InvalidStudiesResponseError) {
    return STUDY_MESSAGES.invalidResponse;
  }

  if (error instanceof ApiError) {
    if (error.status === 403) {
      return STUDY_MESSAGES.forbidden;
    }
    if (error.status >= 500) {
      return STUDY_MESSAGES.serviceUnavailable;
    }
    return STUDY_MESSAGES.listFailed;
  }

  return STUDY_MESSAGES.listFailed;
}
