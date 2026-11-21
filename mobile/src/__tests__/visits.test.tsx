import { router } from 'expo-router';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  testRouter,
  waitFor,
} from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import RootLayout from '../app/_layout';
import ActivationScreen from '../app/activation';
import ChangePasswordScreen from '../app/change-password';
import HomeScreen from '../app/index';
import InvitationDetailScreen from '../app/invitations/[candidateId]';
import InvitationsScreen from '../app/invitations/index';
import LoginScreen from '../app/login';
import StudiesScreen from '../app/studies/index';
import StudyDetailScreen from '../app/studies/[participantId]';
import VisitsScreen from '../app/visits/index';
import { ApiError } from '../services/api/apiClient';
import * as authApi from '../services/auth/authApi';
import { AUTH_MESSAGES } from '../services/auth/authErrors';
import { formatDateTime } from '../services/format/dateFormat';
import * as invitationApi from '../services/invitations/invitationApi';
import * as studyApi from '../services/studies/studyApi';
import * as visitApi from '../services/visits/visitApi';
import { InvalidVisitsResponseError } from '../services/visits/visitApi';
import { VISIT_MESSAGES } from '../services/visits/visitErrors';
import type {
  ParticipantVisit,
  ParticipantVisits,
} from '../services/visits/visitTypes';

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../services/auth/authApi', () => ({
  activateAccountWithCode: jest.fn(),
  loginWithPassword: jest.fn(),
  changeAccountPassword: jest.fn(),
  logoutSession: jest.fn(),
}));

jest.mock('../services/studies/studyApi', () => ({
  ...jest.requireActual<typeof import('../services/studies/studyApi')>(
    '../services/studies/studyApi',
  ),
  listMyStudies: jest.fn(),
}));

jest.mock('../services/invitations/invitationApi', () => ({
  listInvitations: jest.fn(),
  getInvitation: jest.fn(),
  decideInvitation: jest.fn(),
}));

jest.mock('../services/visits/visitApi', () => ({
  ...jest.requireActual<typeof import('../services/visits/visitApi')>(
    '../services/visits/visitApi',
  ),
  getMyVisits: jest.fn(),
}));

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const auth = authApi as jest.Mocked<typeof authApi>;
const studies = studyApi as jest.Mocked<typeof studyApi>;
const invitations = invitationApi as jest.Mocked<typeof invitationApi>;
const api = visitApi as jest.Mocked<typeof visitApi>;

const scheduledVisit: ParticipantVisit = {
  id: 15,
  studyId: 1,
  studyTitle: 'Acompanhamento de hipertensão',
  participantId: 11,
  plannedVisitId: 3,
  plannedVisitName: 'Visita de retorno',
  scheduledAt: new Date(2027, 2, 10, 14, 30, 0).toISOString(),
  status: 'SCHEDULED',
  activities: [
    {
      id: 22,
      name: 'Aferição clínica',
      description: 'Acompanhamento dos sinais vitais.',
      position: 1,
    },
  ],
};

const doneVisit: ParticipantVisit = {
  id: 10,
  studyId: 1,
  studyTitle: 'Acompanhamento de hipertensão',
  participantId: 11,
  plannedVisitId: 1,
  plannedVisitName: 'Visita inicial',
  scheduledAt: new Date(2027, 0, 10, 9, 0, 0).toISOString(),
  status: 'DONE',
  outcomeAt: new Date(2027, 0, 10, 10, 0, 0).toISOString(),
  activities: [],
};

const absentVisit: ParticipantVisit = {
  id: 11,
  studyId: 2,
  studyTitle: 'Estudo de hábitos de sono',
  participantId: 12,
  plannedVisitId: 4,
  plannedVisitName: 'Controle quinzenal',
  scheduledAt: new Date(2027, 0, 20, 11, 0, 0).toISOString(),
  status: 'ABSENT',
  outcomeAt: new Date(2027, 0, 20, 12, 15, 0).toISOString(),
  activities: [],
};

const cancelledVisit: ParticipantVisit = {
  id: 12,
  studyId: 2,
  studyTitle: 'Estudo de hábitos de sono',
  participantId: 12,
  plannedVisitId: 5,
  plannedVisitName: 'Avaliação intermediária',
  scheduledAt: new Date(2027, 1, 1, 15, 45, 0).toISOString(),
  status: 'CANCELLED',
  outcomeAt: new Date(2027, 0, 25, 16, 0, 0).toISOString(),
  cancellationReason: 'Participante pediu para remarcar',
  activities: [],
};

let storedValue: string | null = null;

beforeEach(() => {
  auth.activateAccountWithCode.mockReset();
  auth.loginWithPassword.mockReset();
  auth.changeAccountPassword.mockReset();
  auth.logoutSession.mockReset();
  studies.listMyStudies.mockReset();
  invitations.listInvitations.mockReset();
  invitations.getInvitation.mockReset();
  invitations.decideInvitation.mockReset();
  api.getMyVisits.mockReset();
  secureStore.isAvailableAsync.mockReset();
  secureStore.getItemAsync.mockReset();
  secureStore.setItemAsync.mockReset();
  secureStore.deleteItemAsync.mockReset();

  storedValue = null;

  secureStore.isAvailableAsync.mockResolvedValue(true);
  secureStore.getItemAsync.mockImplementation(async () => storedValue);
  secureStore.setItemAsync.mockImplementation(async (_key, value) => {
    storedValue = value;
  });
  secureStore.deleteItemAsync.mockImplementation(async () => {
    storedValue = null;
  });
});

function storeSession(
  options: { mustChangePassword?: boolean } = {},
): void {
  const { mustChangePassword = false } = options;

  storedValue = JSON.stringify({
    version: 1,
    accessToken: 'header.payload.signature',
    expiresAt: Date.now() + 3_600_000,
    user: {
      id: 7,
      name: 'Raffael Souza',
      email: 'raffael@exemplo.test',
      role: 'PARTICIPANT',
      active: true,
      mustChangePassword,
    },
  });
}

async function renderApp(initialUrl: string) {
  return renderRouter(
    {
      _layout: RootLayout,
      login: LoginScreen,
      activation: ActivationScreen,
      index: HomeScreen,
      'studies/index': StudiesScreen,
      'studies/[participantId]': StudyDetailScreen,
      'visits/index': VisitsScreen,
      'change-password': ChangePasswordScreen,
      'invitations/index': InvitationsScreen,
      'invitations/[candidateId]': InvitationDetailScreen,
    },
    { initialUrl },
  );
}

async function renderAuthenticatedAt(pathname: string) {
  const result = await renderApp('/');
  await screen.findByText(/Olá, Raffael!/);
  await testRouter.push(pathname);
  return result;
}

describe('visitas do participante', () => {
  it('abre pela Home, mostra carregamento, lista Próximas e alterna para Histórico com desfechos e motivo só em cancelada', async () => {
    storeSession();
    let resolveVisits: ((value: ParticipantVisits) => void) | undefined;
    api.getMyVisits.mockImplementation(
      () =>
        new Promise<ParticipantVisits>((resolve) => {
          resolveVisits = resolve;
        }),
    );

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver visitas'));

    await waitFor(() => expect(screen).toHavePathname('/visits'));
    expect(await screen.findByText('Carregando visitas…')).toBeTruthy();
    expect(api.getMyVisits).toHaveBeenCalledWith(
      'header.payload.signature',
      expect.anything(),
    );

    await act(async () => {
      resolveVisits?.({
        upcoming: [scheduledVisit],
        history: [cancelledVisit, absentVisit, doneVisit],
      });
    });

    expect(await screen.findByText('Visita de retorno')).toBeTruthy();
    expect(screen.getByText('Agendada')).toBeTruthy();
    expect(
      screen.getByText('Estudo: Acompanhamento de hipertensão'),
    ).toBeTruthy();
    expect(
      screen.getByText(formatDateTime(scheduledVisit.scheduledAt) as string),
    ).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Próximas' }).props.accessibilityState,
    ).toEqual({ selected: true });
    expect(screen.queryByText('Visita inicial')).toBeNull();

    await fireEvent.press(screen.getByRole('tab', { name: 'Histórico' }));

    expect(
      screen.getByRole('tab', { name: 'Histórico' }).props.accessibilityState,
    ).toEqual({ selected: true });
    expect(screen.queryByText('Visita de retorno')).toBeNull();
    expect(screen.getByText('Avaliação intermediária')).toBeTruthy();
    expect(screen.getByText('Cancelada')).toBeTruthy();
    expect(
      screen.getByText('Motivo: Participante pediu para remarcar'),
    ).toBeTruthy();
    expect(screen.getAllByText(/^Motivo:/)).toHaveLength(1);
    expect(screen.getByText('Controle quinzenal')).toBeTruthy();
    expect(screen.getByText('Ausente')).toBeTruthy();
    expect(screen.getByText('Visita inicial')).toBeTruthy();
    expect(screen.getByText('Realizada')).toBeTruthy();
    expect(
      screen.getByText(
        `Desfecho em ${formatDateTime(doneVisit.outcomeAt as string)}`,
      ),
    ).toBeTruthy();
  });

  it('migra visita de Próximas para Histórico após o desfecho registrado (CA1)', async () => {
    storeSession();
    const completedVisit: ParticipantVisit = {
      ...scheduledVisit,
      status: 'DONE',
      outcomeAt: new Date(2027, 2, 10, 15, 0, 0).toISOString(),
    };
    api.getMyVisits
      .mockResolvedValueOnce({
        upcoming: [scheduledVisit],
        history: [],
      })
      .mockResolvedValueOnce({
        upcoming: [],
        history: [completedVisit],
      });

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver visitas'));
    expect(await screen.findByText('Visita de retorno')).toBeTruthy();
    expect(screen.getByText('Agendada')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Histórico' }));
    expect(
      await screen.findByText(VISIT_MESSAGES.emptyHistoryTitle),
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Voltar'));
    await waitFor(() => expect(screen).toHavePathname('/'));

    await fireEvent.press(screen.getByText('Ver visitas'));
    expect(
      await screen.findByText(VISIT_MESSAGES.emptyUpcomingTitle),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Histórico' }));
    expect(await screen.findByText('Visita de retorno')).toBeTruthy();
    expect(screen.getByText('Realizada')).toBeTruthy();
    expect(
      screen.getByText(
        `Desfecho em ${formatDateTime(completedVisit.outcomeAt as string)}`,
      ),
    ).toBeTruthy();
  });

  it('exibe estados vazios distintos para Próximas e Histórico', async () => {
    storeSession();
    api.getMyVisits.mockResolvedValue({ upcoming: [], history: [] });

    await renderAuthenticatedAt('/visits');

    expect(
      await screen.findByText(VISIT_MESSAGES.emptyUpcomingTitle),
    ).toBeTruthy();
    expect(screen.getByText(VISIT_MESSAGES.emptyUpcoming)).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Histórico' }));

    expect(
      await screen.findByText(VISIT_MESSAGES.emptyHistoryTitle),
    ).toBeTruthy();
    expect(screen.getByText(VISIT_MESSAGES.emptyHistory)).toBeTruthy();
  });

  it('mostra erro na falha inicial sem exibir estado vazio e permite tentar novamente', async () => {
    storeSession();
    api.getMyVisits
      .mockRejectedValueOnce(new ApiError('indisponível', 503))
      .mockResolvedValueOnce({
        upcoming: [scheduledVisit],
        history: [],
      });

    await renderAuthenticatedAt('/visits');

    expect(
      await screen.findByText(VISIT_MESSAGES.serviceUnavailable),
    ).toBeTruthy();
    expect(screen.queryByText(VISIT_MESSAGES.emptyUpcomingTitle)).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Próximas' })).toBeNull();

    await fireEvent.press(screen.getByText('Tentar novamente'));

    expect(await screen.findByText('Visita de retorno')).toBeTruthy();
    expect(screen.queryByText(VISIT_MESSAGES.serviceUnavailable)).toBeNull();
    expect(api.getMyVisits).toHaveBeenCalledTimes(2);
  });

  it('traduz payload inválido e 403 sem vazar detalhes internos', async () => {
    storeSession();
    api.getMyVisits
      .mockRejectedValueOnce(new InvalidVisitsResponseError())
      .mockRejectedValueOnce(new ApiError('detalhe interno', 403, 'FORBIDDEN'));

    await renderAuthenticatedAt('/visits');

    expect(
      await screen.findByText(VISIT_MESSAGES.invalidResponse),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Tentar novamente'));

    expect(await screen.findByText(VISIT_MESSAGES.forbidden)).toBeTruthy();
    expect(screen.queryByText(/detalhe interno/)).toBeNull();
  });

  it('mantém visitas anteriores e indica consulta anterior se falhar ao voltar ao foco', async () => {
    storeSession();
    api.getMyVisits
      .mockResolvedValueOnce({ upcoming: [scheduledVisit], history: [] })
      .mockRejectedValueOnce(new ApiError('indisponível', 503))
      .mockResolvedValueOnce({ upcoming: [scheduledVisit], history: [] });

    await renderAuthenticatedAt('/visits');
    expect(await screen.findByText('Visita de retorno')).toBeTruthy();

    await testRouter.push('/change-password');
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );

    await testRouter.back();
    await waitFor(() => expect(screen).toHavePathname('/visits'));

    expect(
      await screen.findByText(
        `${VISIT_MESSAGES.serviceUnavailable} ${VISIT_MESSAGES.previousData}`,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Visita de retorno')).toBeTruthy();

    await fireEvent.press(screen.getByText('Tentar novamente'));

    await waitFor(() =>
      expect(screen.queryByText(/consulta anterior/)).toBeNull(),
    );
    expect(api.getMyVisits).toHaveBeenCalledTimes(3);
  });

  it('leva ao login sem exibir erro adicional quando a sessão expira com 401', async () => {
    storeSession();
    api.getMyVisits.mockRejectedValue(new ApiError('não autorizado', 401));

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver visitas'));

    expect(await screen.findByText(AUTH_MESSAGES.sessionExpired)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    await waitFor(() => expect(storedValue).toBeNull());
    expect(screen.queryByText(VISIT_MESSAGES.listFailed)).toBeNull();
  });

  it('restringe a sessão ao receber 403 PASSWORD_CHANGE_REQUIRED na lista', async () => {
    storeSession();
    api.getMyVisits.mockRejectedValue(
      new ApiError('troca pendente', 403, 'PASSWORD_CHANGE_REQUIRED'),
    );

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver visitas'));

    expect(await screen.findByText('Defina sua nova senha')).toBeTruthy();
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );
    expect(screen.queryByText(VISIT_MESSAGES.forbidden)).toBeNull();
    expect(screen.queryByText(VISIT_MESSAGES.listFailed)).toBeNull();
  });

  it('bloqueia acesso a /visits quando mustChangePassword está ativo', async () => {
    storeSession({ mustChangePassword: true });

    await renderApp('/');
    await screen.findByText('Defina sua nova senha');

    await act(async () => {
      router.push('/visits');
    });
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );
    expect(api.getMyVisits).not.toHaveBeenCalled();
  });

  it('descarta resposta tardia quando a sessão é encerrada durante a consulta', async () => {
    storeSession();
    let resolveVisits: ((value: ParticipantVisits) => void) | undefined;
    api.getMyVisits.mockImplementation(
      () =>
        new Promise<ParticipantVisits>((resolve) => {
          resolveVisits = resolve;
        }),
    );

    await renderAuthenticatedAt('/visits');
    expect(await screen.findByText('Carregando visitas…')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Voltar'));
    await waitFor(() => expect(screen).toHavePathname('/'));

    await fireEvent.press(screen.getByText('Sair'));
    await fireEvent.press(screen.getByText('Sair da conta'));
    expect(await screen.findByText('Login')).toBeTruthy();

    await act(async () => {
      resolveVisits?.({ upcoming: [scheduledVisit], history: [] });
    });

    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.queryByText('Visita de retorno')).toBeNull();
  });

  it('bloqueia acesso direto a /visits sem sessão', async () => {
    await renderApp('/');
    await screen.findByText('Login');
    await waitFor(() => expect(screen).toHavePathname('/login'));

    await act(async () => {
      router.push('/visits');
    });

    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(api.getMyVisits).not.toHaveBeenCalled();
  });
});
