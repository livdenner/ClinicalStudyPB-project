import { ApiError } from '../api/apiClient';
import { InvalidVisitsResponseError } from './visitApi';

/** Mensagens das visitas; nenhuma expõe dados privados ou detalhes internos. */
export const VISIT_MESSAGES = {
  listFailed:
    'Não foi possível carregar suas visitas. Verifique sua conexão e tente novamente.',
  detailFailed:
    'Não foi possível carregar os detalhes desta visita. Tente novamente.',
  forbidden: 'Sua conta não tem permissão para consultar visitas.',
  serviceUnavailable:
    'O serviço está indisponível no momento. Tente novamente.',
  invalidResponse:
    'Não foi possível ler os dados das suas visitas. Tente novamente.',
  invalidId: 'Visita inválida. Volte à lista e escolha uma visita.',
  notAvailable:
    'Esta visita não está disponível para sua conta. Volte à lista para conferir suas visitas.',
  previousData:
    'As visitas exibidas são de uma consulta anterior e podem estar desatualizadas.',
  previousDetailData:
    'Os dados exibidos são de uma consulta anterior e podem estar desatualizadas.',
  emptyUpcomingTitle: 'Nenhuma próxima visita',
  emptyUpcoming: 'Você não possui próximas visitas agendadas no momento.',
  emptyHistoryTitle: 'Seu histórico está vazio',
  emptyHistory:
    'Quando alguma visita for realizada, ausente ou cancelada, ela aparecerá aqui.',
  emptyActivities: 'Sem atividades previstas para esta visita.',
  rf19ReservedTitle: 'Presença e reagendamento',
  rf19ReservedBody:
    'As opções para confirmar presença ou solicitar reagendamento serão disponibilizadas em uma próxima atualização.',
  finalizedOutcomeNotice:
    'Esta visita já teve seu desfecho registrado pela equipe do estudo e permanece disponível apenas para consulta.',
} as const;

/** Escopo da leitura para adaptar a mensagem de erro sem vazar detalhes. */
export type VisitLoadScope = 'list' | 'detail';

/**
 * Traduz um erro ao carregar visitas em uma mensagem segura. Usa apenas a
 * classe do erro e o status HTTP, nunca textos crus devolvidos pela API.
 *
 * @param error Erro lançado pelo cliente HTTP, parser ou rede.
 * @param scope Lista ou detalhe da visita.
 * @returns Mensagem pronta para exibição na tela.
 */
export function getVisitLoadErrorMessage(
  error: unknown,
  scope: VisitLoadScope = 'list',
): string {
  if (error instanceof InvalidVisitsResponseError) {
    return VISIT_MESSAGES.invalidResponse;
  }

  if (error instanceof ApiError) {
    if (error.status === 403) {
      return VISIT_MESSAGES.forbidden;
    }
    if (error.status >= 500) {
      return VISIT_MESSAGES.serviceUnavailable;
    }
    return scope === 'detail'
      ? VISIT_MESSAGES.detailFailed
      : VISIT_MESSAGES.listFailed;
  }

  return scope === 'detail'
    ? VISIT_MESSAGES.detailFailed
    : VISIT_MESSAGES.listFailed;
}
