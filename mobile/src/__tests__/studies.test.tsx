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
import VisitDetailScreen from '../app/visits/[visitId]';
import VisitsScreen from '../app/visits/index';
import { ApiError } from '../services/api/apiClient';
import * as authApi from '../services/auth/authApi';
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

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const auth = authApi as jest.Mocked<typeof authApi>;
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
  auth.activateAccountWithCode.mockReset();
  auth.loginWithPassword.mockReset();
  auth.changeAccountPassword.mockReset();
  auth.logoutSession.mockReset();
  api.listMyStudies.mockReset();
  invitations.listInvitations.mockReset();
  invitations.getInvitation.mockReset();
  invitations.decideInvitation.mockReset();
  secureStore.isAvailableAsync.mockReset();
  secureStore.getItemAsync.mockReset();
  secureStore.setItemAsync.mockReset();
  secureStore.deleteItemAsync.mockReset();

  storedValue = null;

  auth.logoutSession.mockResolvedValue(undefined);
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
      'visits/[visitId]': VisitDetailScreen,
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

describe('RF17 — estudos do participante', () => {
  it('RF17: exibe carregamento e lista dois estudos na ordem da API com estados distintos', async () => {
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

  it('RF17: navega da lista para o detalhe com objetivo e visitas previstas e volta à lista', async () => {
    storeSession();
    api.listMyStudies.mockResolvedValue([withdrawnStudy, activeStudy]);

    await renderAuthenticatedAt('/studies');
    await screen.findByText('Acompanhamento de hipertensão');

    await fireEvent.press(
      screen.getByLabelText(
        'Acompanhamento de hipertensão. Em execução. Participação ativa',
      ),
    );

    await waitFor(() => expect(screen).toHavePathname('/studies/11'));
    expect(
      await screen.findByText('Avaliar a adesão ao acompanhamento fictício.'),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Paula Pesquisadora/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/01\/01\/2027 a 31\/12\/2027/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Visita inicial')).toBeTruthy();
    expect(screen.getByText('Data prevista: 01/02/2027')).toBeTruthy();
    expect(
      screen.getByText('• Triagem inicial — Registro de acompanhamento.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Voltar'));

    await waitFor(() => expect(screen).toHavePathname('/studies'));
    expect(
      await screen.findByText('Estudo de hábitos de sono'),
    ).toBeTruthy();
  });

  it('RF17: exibe protocolo vazio e orientação para participação retirada no detalhe', async () => {
    storeSession();
    api.listMyStudies.mockResolvedValue([withdrawnStudy, activeStudy]);

    await renderAuthenticatedAt('/studies');
    await screen.findByText('Estudo de hábitos de sono');

    await fireEvent.press(
      screen.getByLabelText(
        'Estudo de hábitos de sono. Cancelado. Participação retirada',
      ),
    );

    await waitFor(() => expect(screen).toHavePathname('/studies/12'));
    expect(
      await screen.findByText(STUDY_MESSAGES.withdrawnNotice),
    ).toBeTruthy();
    expect(screen.getByText(STUDY_MESSAGES.emptyVisits)).toBeTruthy();
    expect(screen.getByText('Cancelado')).toBeTruthy();
    expect(screen.getByText('Participação retirada')).toBeTruthy();
    expect(screen.getByText(/12\/11\/2026 09:30/)).toBeTruthy();
  });

  it('RF17: resolve o detalhe ao abrir diretamente a rota sem depender de parâmetros da lista', async () => {
    storeSession();
    api.listMyStudies.mockResolvedValue([withdrawnStudy, activeStudy]);

    await renderAuthenticatedAt('/studies/11');

    expect(
      await screen.findByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();
    expect(
      screen.getByText('Avaliar a adesão ao acompanhamento fictício.'),
    ).toBeTruthy();
    expect(api.listMyStudies).toHaveBeenCalledWith(
      'header.payload.signature',
      expect.anything(),
    );
  });

  it('RF17: recusa identificador inválido no detalhe sem consultar a API e volta à lista', async () => {
    storeSession();
    api.listMyStudies.mockResolvedValue([activeStudy]);

    await renderAuthenticatedAt('/studies/abc');

    expect(await screen.findByText(STUDY_MESSAGES.invalidId)).toBeTruthy();
    expect(api.listMyStudies).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Voltar aos estudos'));
    await waitFor(() => expect(screen).toHavePathname('/studies'));
    expect(
      await screen.findByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();

    await testRouter.replace('/studies/0');
    expect(await screen.findByText(STUDY_MESSAGES.invalidId)).toBeTruthy();
    expect(api.listMyStudies).toHaveBeenCalledTimes(1);
  });

  it('RF17: exibe indisponibilidade quando a participação não pertence à conta autenticada', async () => {
    storeSession();
    api.listMyStudies.mockResolvedValue([activeStudy]);

    await renderAuthenticatedAt('/studies/999');

    expect(await screen.findByText(STUDY_MESSAGES.notAvailable)).toBeTruthy();
    expect(screen.queryByText('Acompanhamento de hipertensão')).toBeNull();
    expect(
      screen.queryByText('Avaliar a adesão ao acompanhamento fictício.'),
    ).toBeNull();

    await fireEvent.press(screen.getByText('Voltar aos estudos'));
    await waitFor(() => expect(screen).toHavePathname('/studies'));
  });

  it('RF17: trata erro no detalhe com retry sem confundir falha com protocolo vazio', async () => {
    storeSession();
    api.listMyStudies
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce([activeStudy]);

    await renderAuthenticatedAt('/studies/11');

    expect(await screen.findByText(STUDY_MESSAGES.detailFailed)).toBeTruthy();
    expect(screen.queryByText(STUDY_MESSAGES.emptyVisits)).toBeNull();

    await fireEvent.press(screen.getByText('Tentar novamente'));

    expect(
      await screen.findByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();
    expect(screen.getByText('Visita inicial')).toBeTruthy();
    expect(api.listMyStudies).toHaveBeenCalledTimes(2);
  });

  it('RF17: aborta a consulta anterior e descarta resposta tardia ao trocar o detalhe', async () => {
    storeSession();
    let firstSignal: AbortSignal | undefined;
    let resolveFirst: ((value: ParticipantStudy[]) => void) | undefined;
    api.listMyStudies
      .mockImplementationOnce((_token, signal) => {
        firstSignal = signal;
        return new Promise<ParticipantStudy[]>((resolve) => {
          resolveFirst = resolve;
        });
      })
      .mockResolvedValueOnce([withdrawnStudy, activeStudy]);

    await renderAuthenticatedAt('/studies/11');
    expect(await screen.findByText('Carregando estudo…')).toBeTruthy();
    expect(firstSignal?.aborted).toBe(false);

    await testRouter.replace('/studies/12');

    expect(firstSignal?.aborted).toBe(true);
    expect(
      await screen.findByText('Estudo de hábitos de sono'),
    ).toBeTruthy();

    await act(async () => {
      resolveFirst?.([
        { ...withdrawnStudy, studyTitle: 'Título desatualizado' },
      ]);
    });

    expect(screen.getByText('Estudo de hábitos de sono')).toBeTruthy();
    expect(screen.queryByText('Título desatualizado')).toBeNull();
  });

  it('RF17: trata estado desconhecido no detalhe com rótulo neutro', async () => {
    storeSession();
    api.listMyStudies.mockResolvedValue([
      {
        ...activeStudy,
        studyStatus: 'DESCONHECIDO',
      },
    ]);

    await renderAuthenticatedAt('/studies/11');

    expect(
      await screen.findByText('Situação não reconhecida'),
    ).toBeTruthy();
  });

  it('RF17: exibe orientação na lista vazia e permite abrir convites', async () => {
    storeSession();
    api.listMyStudies.mockResolvedValue([]);
    invitations.listInvitations.mockResolvedValue([]);

    await renderAuthenticatedAt('/studies');

    expect(await screen.findByText(STUDY_MESSAGES.empty)).toBeTruthy();
    expect(screen.queryByText(/Incluído em /)).toBeNull();

    await fireEvent.press(screen.getByText('Ver convites'));

    await waitFor(() => expect(screen).toHavePathname('/invitations'));
  });

  it('RF17: mostra erro na falha inicial e recupera ao tentar novamente', async () => {
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

  it('RF17: não mascara resposta inválida ou acesso negado como lista vazia', async () => {
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

  it('RF17: reconsulta ao voltar ao foco e indica dados anteriores em caso de erro', async () => {
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

  it('RF02/RF17: leva ao login quando a sessão expira com 401 sem erro genérico adicional', async () => {
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

  it('RF17: cancela e descarta resposta tardia ao sair da tela', async () => {
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

  it('RF03/RF17: bloqueia acesso direto à lista sem sessão autenticada', async () => {
    await renderApp('/studies');

    expect(await screen.findByText('Login')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(api.listMyStudies).not.toHaveBeenCalled();
  });

  it('RF03/RF17: bloqueia acesso direto ao detalhe sem sessão autenticada', async () => {
    await renderApp('/studies/11');

    expect(await screen.findByText('Login')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(api.listMyStudies).not.toHaveBeenCalled();
  });

  it('RF03/RF17: não conserva estudos da conta anterior após logout e entrada em outra conta', async () => {
    storeSession();
    api.listMyStudies
      .mockResolvedValueOnce([withdrawnStudy, activeStudy])
      .mockResolvedValueOnce([]);
    auth.loginWithPassword.mockResolvedValue({
      accessToken: 'token.conta.b',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: 8,
        name: 'Bruno Lima',
        email: 'bruno@exemplo.test',
        role: 'PARTICIPANT',
        active: true,
        mustChangePassword: false,
      },
    });

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver estudos'));
    expect(
      await screen.findByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Voltar'));
    await waitFor(() => expect(screen).toHavePathname('/'));

    await fireEvent.press(screen.getByText('Sair'));
    await fireEvent.press(screen.getByText('Sair da conta'));
    expect(await screen.findByText('Login')).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText('E-mail institucional'),
      'bruno@exemplo.test',
    );
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'Senha12345');
    await fireEvent.press(screen.getByText('Entrar'));

    expect(await screen.findByText(/Olá, Bruno!/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Ver estudos'));
    expect(await screen.findByText(STUDY_MESSAGES.empty)).toBeTruthy();
    expect(screen.queryByText('Acompanhamento de hipertensão')).toBeNull();
    expect(screen.queryByText('Estudo de hábitos de sono')).toBeNull();
    expect(api.listMyStudies).toHaveBeenLastCalledWith(
      'token.conta.b',
      expect.anything(),
    );
  });

  it('RF03/RF17: restringe a sessão ao receber 403 PASSWORD_CHANGE_REQUIRED na lista', async () => {
    storeSession();
    api.listMyStudies.mockRejectedValue(
      new ApiError('troca pendente', 403, 'PASSWORD_CHANGE_REQUIRED'),
    );

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver estudos'));

    expect(await screen.findByText('Defina sua nova senha')).toBeTruthy();
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );
    expect(screen.queryByText(STUDY_MESSAGES.forbidden)).toBeNull();
    expect(screen.queryByText(STUDY_MESSAGES.listFailed)).toBeNull();
  });

  it('RF03/RF17: restringe a sessão ao receber 403 PASSWORD_CHANGE_REQUIRED no detalhe', async () => {
    storeSession();
    api.listMyStudies
      .mockResolvedValueOnce([activeStudy])
      .mockRejectedValueOnce(
        new ApiError('troca pendente', 403, 'PASSWORD_CHANGE_REQUIRED'),
      );

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver estudos'));
    await screen.findByText('Acompanhamento de hipertensão');

    await fireEvent.press(
      screen.getByLabelText(
        'Acompanhamento de hipertensão. Em execução. Participação ativa',
      ),
    );

    expect(await screen.findByText('Defina sua nova senha')).toBeTruthy();
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );
    expect(screen.queryByText(STUDY_MESSAGES.forbidden)).toBeNull();
    expect(screen.queryByText(STUDY_MESSAGES.detailFailed)).toBeNull();
  });

  it('RF03/RF17: bloqueia acesso à lista e ao detalhe quando mustChangePassword está ativo', async () => {
    storeSession({ mustChangePassword: true });

    await renderApp('/');
    await screen.findByText('Defina sua nova senha');

    await act(async () => {
      router.push('/studies');
    });
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );

    await act(async () => {
      router.push('/studies/11');
    });
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );
    expect(api.listMyStudies).not.toHaveBeenCalled();
  });

  it('RF02/RF17: leva ao login quando a sessão expira com 401 no detalhe sem erro adicional', async () => {
    storeSession();
    api.listMyStudies
      .mockResolvedValueOnce([activeStudy])
      .mockRejectedValueOnce(new ApiError('não autorizado', 401));

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver estudos'));
    await screen.findByText('Acompanhamento de hipertensão');

    await fireEvent.press(
      screen.getByLabelText(
        'Acompanhamento de hipertensão. Em execução. Participação ativa',
      ),
    );

    expect(await screen.findByText(AUTH_MESSAGES.sessionExpired)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    await waitFor(() => expect(storedValue).toBeNull());
    expect(screen.queryByText(STUDY_MESSAGES.detailFailed)).toBeNull();
  });

  it('RF17: reconsulta o detalhe ao voltar ao foco e indica dados anteriores em caso de erro', async () => {
    storeSession();
    api.listMyStudies
      .mockResolvedValueOnce([activeStudy])
      .mockRejectedValueOnce(new ApiError('indisponível', 503))
      .mockResolvedValueOnce([activeStudy]);

    await renderAuthenticatedAt('/studies/11');
    expect(
      await screen.findByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();

    await testRouter.push('/change-password');
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );

    await testRouter.back();
    await waitFor(() => expect(screen).toHavePathname('/studies/11'));

    expect(
      await screen.findByText(
        `${STUDY_MESSAGES.serviceUnavailable} ${STUDY_MESSAGES.previousDetailData}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Acompanhamento de hipertensão'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Tentar novamente'));

    await waitFor(() =>
      expect(screen.queryByText(/consulta anterior/)).toBeNull(),
    );
    expect(screen.getByText('Visita inicial')).toBeTruthy();
    expect(api.listMyStudies).toHaveBeenCalledTimes(3);
  });

  it('RF02/RF17: descarta resposta tardia quando a sessão é encerrada durante a consulta', async () => {
    storeSession();
    let resolveList: ((value: ParticipantStudy[]) => void) | undefined;
    api.listMyStudies.mockImplementation(
      () =>
        new Promise<ParticipantStudy[]>((resolve) => {
          resolveList = resolve;
        }),
    );

    await renderAuthenticatedAt('/studies');
    expect(await screen.findByText('Carregando estudos…')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Voltar'));
    await waitFor(() => expect(screen).toHavePathname('/'));

    await fireEvent.press(screen.getByText('Sair'));
    await fireEvent.press(screen.getByText('Sair da conta'));
    expect(await screen.findByText('Login')).toBeTruthy();

    await act(async () => {
      resolveList?.([activeStudy]);
    });

    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.queryByText('Acompanhamento de hipertensão')).toBeNull();
  });
});
