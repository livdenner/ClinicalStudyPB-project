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
import StudiesScreen from '../app/studies';
import { ApiError } from '../services/api/apiClient';
import { AUTH_MESSAGES } from '../services/auth/authErrors';
import * as invitationApi from '../services/invitations/invitationApi';
import * as studyApi from '../services/studies/studyApi';
import { InvalidStudiesResponseError } from '../services/studies/studyApi';
import { STUDY_MESSAGES } from '../services/studies/studyErrors';
import type { ParticipantStudy } from '../services/studies/studyTypes';

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
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

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const api = studyApi as jest.Mocked<typeof studyApi>;
const invitations = invitationApi as jest.Mocked<typeof invitationApi>;

const withdrawnStudy: ParticipantStudy = {
  participantId: 12,
  studyId: 2,
  studyTitle: 'Estudo de hábitos de sono',
  studyObjective: 'Analisar rotina de descanso.',
  studyStatus: 'CANCELLED',
  startDate: '2026-08-01',
  endDate: '2026-12-31',
  responsibleName: 'Carlos Pesquisador',
  participationStatus: 'WITHDRAWN',
  includedAt: new Date(2026, 10, 10, 14, 0, 0).toISOString(),
  withdrawnAt: new Date(2026, 10, 12, 9, 30, 0).toISOString(),
  plannedVisits: [],
};

const activeStudy: ParticipantStudy = {
  participantId: 11,
  studyId: 1,
  studyTitle: 'Acompanhamento de hipertensão',
  studyObjective: 'Avaliar a adesão ao acompanhamento fictício.',
  studyStatus: 'EXECUTION',
  startDate: '2027-01-01',
  endDate: '2027-12-31',
  responsibleName: 'Paula Pesquisadora',
  participationStatus: 'ACTIVE',
  includedAt: new Date(2026, 10, 1, 10, 15, 0).toISOString(),
  plannedVisits: [
    {
      id: 10,
      studyId: 1,
      name: 'Visita inicial',
      plannedDate: '2027-02-01',
      position: 1,
      activities: [
        {
          id: 21,
          name: 'Triagem inicial',
          description: 'Registro de acompanhamento.',
          position: 1,
        },
      ],
    },
  ],
};

let storedValue: string | null = null;

beforeEach(() => {
  api.listMyStudies.mockReset();
  invitations.listInvitations.mockReset();
  invitations.getInvitation.mockReset();
  invitations.decideInvitation.mockReset();
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

function storeSession(): void {
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
      mustChangePassword: false,
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
      studies: StudiesScreen,
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

describe('estudos do participante', () => {
  it('exibe carregamento e lista dois estudos na ordem da API com estados distintos', async () => {
    storeSession();
    let resolveList: ((value: ParticipantStudy[]) => void) | undefined;
    api.listMyStudies.mockImplementation(
      () =>
        new Promise<ParticipantStudy[]>((resolve) => {
          resolveList = resolve;
        }),
    );

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver estudos'));

    await waitFor(() => expect(screen).toHavePathname('/studies'));
    expect(await screen.findByText('Carregando estudos…')).toBeTruthy();

    await act(async () => {
      resolveList?.([withdrawnStudy, activeStudy]);
    });

    expect(
      await screen.findByText('Estudo de hábitos de sono'),
    ).toBeTruthy();
    expect(
      screen.getByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();
    expect(screen.getByText('Cancelado')).toBeTruthy();
    expect(screen.getByText('Em execução')).toBeTruthy();
    expect(screen.getByText('Participação retirada')).toBeTruthy();
    expect(screen.getByText('Participação ativa')).toBeTruthy();

    const inclusionDates = screen.getAllByText(/Incluído em /);
    expect(inclusionDates).toHaveLength(2);
    expect(inclusionDates[0].props.children).toBe(
      'Incluído em 10/11/2026 14:00',
    );
    expect(inclusionDates[1].props.children).toBe(
      'Incluído em 01/11/2026 10:15',
    );
    expect(screen.getByText('Retirado em 12/11/2026 09:30')).toBeTruthy();

    expect(api.listMyStudies).toHaveBeenCalledWith(
      'header.payload.signature',
      expect.anything(),
    );
  });

  it('exibe orientação na lista vazia e permite abrir convites', async () => {
    storeSession();
    api.listMyStudies.mockResolvedValue([]);
    invitations.listInvitations.mockResolvedValue([]);

    await renderAuthenticatedAt('/studies');

    expect(await screen.findByText(STUDY_MESSAGES.empty)).toBeTruthy();
    expect(screen.queryByText(/Incluído em /)).toBeNull();

    await fireEvent.press(screen.getByText('Ver convites'));

    await waitFor(() => expect(screen).toHavePathname('/invitations'));
  });

  it('mostra erro na falha inicial e recupera ao tentar novamente', async () => {
    storeSession();
    api.listMyStudies
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce([withdrawnStudy, activeStudy]);

    await renderAuthenticatedAt('/studies');

    expect(await screen.findByText(STUDY_MESSAGES.listFailed)).toBeTruthy();
    expect(screen.queryByText(STUDY_MESSAGES.empty)).toBeNull();

    await fireEvent.press(screen.getByText('Tentar novamente'));

    expect(
      await screen.findByText('Estudo de hábitos de sono'),
    ).toBeTruthy();
    expect(
      screen.getByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();
    expect(screen.queryByText(STUDY_MESSAGES.listFailed)).toBeNull();
    expect(api.listMyStudies).toHaveBeenCalledTimes(2);
  });

  it('não mascara resposta inválida ou acesso negado como lista vazia', async () => {
    storeSession();
    api.listMyStudies
      .mockRejectedValueOnce(new InvalidStudiesResponseError())
      .mockRejectedValueOnce(
        new ApiError('detalhe interno', 403, 'FORBIDDEN'),
      );

    await renderAuthenticatedAt('/studies');

    expect(
      await screen.findByText(STUDY_MESSAGES.invalidResponse),
    ).toBeTruthy();
    expect(screen.queryByText(STUDY_MESSAGES.empty)).toBeNull();

    await fireEvent.press(screen.getByText('Tentar novamente'));

    expect(await screen.findByText(STUDY_MESSAGES.forbidden)).toBeTruthy();
    expect(screen.queryByText('detalhe interno')).toBeNull();
    expect(screen.queryByText(STUDY_MESSAGES.empty)).toBeNull();
  });

  it('reconsulta ao voltar ao foco e indica dados anteriores em caso de erro', async () => {
    storeSession();
    api.listMyStudies
      .mockResolvedValueOnce([activeStudy])
      .mockRejectedValueOnce(new ApiError('indisponível', 503))
      .mockResolvedValueOnce([withdrawnStudy, activeStudy]);

    await renderAuthenticatedAt('/studies');
    expect(
      await screen.findByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();

    await testRouter.push('/change-password');
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );

    await testRouter.back();
    await waitFor(() => expect(screen).toHavePathname('/studies'));

    expect(
      await screen.findByText(
        `${STUDY_MESSAGES.serviceUnavailable} ${STUDY_MESSAGES.previousData}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Tentar novamente'));

    expect(
      await screen.findByText('Estudo de hábitos de sono'),
    ).toBeTruthy();
    expect(screen.queryByText(/consulta anterior/)).toBeNull();
    expect(api.listMyStudies).toHaveBeenCalledTimes(3);
  });

  it('leva ao login quando a sessão expira com 401 sem erro genérico adicional', async () => {
    storeSession();
    api.listMyStudies.mockRejectedValue(
      new ApiError('não autorizado', 401),
    );

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver estudos'));

    expect(await screen.findByText(AUTH_MESSAGES.sessionExpired)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    await waitFor(() => expect(storedValue).toBeNull());
    expect(screen.queryByText(STUDY_MESSAGES.listFailed)).toBeNull();
  });

  it('cancela e descarta resposta tardia ao sair da tela', async () => {
    storeSession();
    let capturedSignal: AbortSignal | undefined;
    let resolveList: ((value: ParticipantStudy[]) => void) | undefined;
    api.listMyStudies.mockImplementation((_token, signal) => {
      capturedSignal = signal;
      return new Promise<ParticipantStudy[]>((resolve) => {
        resolveList = resolve;
      });
    });

    await renderAuthenticatedAt('/studies');
    expect(await screen.findByText('Carregando estudos…')).toBeTruthy();
    expect(capturedSignal?.aborted).toBe(false);

    await fireEvent.press(screen.getByLabelText('Voltar'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      resolveList?.([activeStudy]);
    });

    expect(screen.queryByText('Acompanhamento de hipertensão')).toBeNull();
  });

  it('bloqueia acesso direto sem sessão autenticada', async () => {
    await renderApp('/studies');

    expect(await screen.findByText('Login')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(api.listMyStudies).not.toHaveBeenCalled();
  });
});
