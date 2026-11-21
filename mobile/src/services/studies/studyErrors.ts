import { ApiError } from '../api/apiClient';
import { InvalidStudiesResponseError } from './studyApi';

/** Mensagens dos estudos; nenhuma expõe dados privados ou detalhes internos. */
export const STUDY_MESSAGES = {
  listFailed:
    'Não foi possível carregar seus estudos. Verifique sua conexão e tente novamente.',
  detailFailed:
    'Não foi possível carregar os detalhes deste estudo. Tente novamente.',
  forbidden: 'Sua conta não tem permissão para consultar estudos.',
  serviceUnavailable:
    'O serviço está indisponível no momento. Tente novamente.',
  invalidResponse:
    'Não foi possível ler os dados dos seus estudos. Tente novamente.',
  invalidId: 'Estudo inválido. Volte à lista e escolha um estudo.',
  notAvailable:
    'Este estudo não está disponível para sua conta. Volte à lista para conferir seus estudos.',
  emptyVisits:
    'Nenhuma visita prevista foi cadastrada no protocolo deste estudo.',
  withdrawnNotice:
    'Sua participação neste estudo foi retirada. Os dados do estudo e do protocolo permanecem disponíveis apenas para consulta.',
  previousData:
    'Os estudos exibidos são de uma consulta anterior e podem estar desatualizados.',
  previousDetailData:
    'Os dados exibidos são de uma consulta anterior e podem estar desatualizados.',
  empty:
    'Você ainda não foi incluído em um estudo. A inclusão é realizada pela coordenação após as etapas necessárias.',
} as const;

/** Escopo da leitura para adaptar a mensagem de erro sem vazar detalhes. */
export type StudyLoadScope = 'list' | 'detail';

/**
 * Traduz um erro ao carregar estudos em uma mensagem segura. Usa apenas a
 * classe do erro e o status HTTP, nunca textos crus devolvidos pela API.
 *
 * @param error Erro lançado pelo cliente HTTP, parser ou rede.
 * @param scope Lista ou detalhe do estudo.
 * @returns Mensagem pronta para exibição na tela.
 */
export function getStudyLoadErrorMessage(
  error: unknown,
  scope: StudyLoadScope = 'list',
): string {
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
    return scope === 'detail'
      ? STUDY_MESSAGES.detailFailed
      : STUDY_MESSAGES.listFailed;
  }

  return scope === 'detail'
    ? STUDY_MESSAGES.detailFailed
    : STUDY_MESSAGES.listFailed;
}
