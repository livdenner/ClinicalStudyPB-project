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
import * as invitationApi from '../services/invitations/invitationApi';
import {
  INVITATION_DECISION_MESSAGES,
  INVITATION_MESSAGES,
} from '../services/invitations/invitationErrors';
import type {
  StudyInvitation,
  StudyInvitationSummary,
} from '../services/invitations/invitationTypes';

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../services/invitations/invitationApi', () => ({
  listInvitations: jest.fn(),
  getInvitation: jest.fn(),
  decideInvitation: jest.fn(),
}));

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const api = invitationApi as jest.Mocked<typeof invitationApi>;

const pendingSummary: StudyInvitationSummary = {
  candidateId: 31,
  studyId: 8,
  studyTitle: 'Estudo de hábitos de sono',
  status: 'CONSENT_PENDING',
};

const grantedSummary: StudyInvitationSummary = {
  candidateId: 32,
  studyId: 9,
  studyTitle: 'Estudo de acompanhamento',
  status: 'GRANTED',
  decidedAt: '2026-11-17T12:05:00.000Z',
};

const pendingDetail: StudyInvitation = {
  ...pendingSummary,
  studyObjective: 'Entender os hábitos de sono dos participantes.',
  startDate: '2026-11-17',
  endDate: '2026-12-20',
  responsibleName: 'Pesquisadora Fictícia',
  plannedVisits: [
    {
      id: 1,
      studyId: 8,
      name: 'Visita de acompanhamento',
      plannedDate: '2026-11-17',
      position: 1,
      activities: [
        {
          id: 5,
          name: 'Medição do sono',
          description: 'Registro feito no aplicativo.',
          position: 1,
        },
      ],
    },
  ],
  termText:
    'Termo de consentimento simulado para demonstração acadêmica, sem valor legal.',
};

let storedValue: string | null = null;

beforeEach(() => {
  api.listInvitations.mockReset();
  api.getInvitation.mockReset();
  api.decideInvitation.mockReset();
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

/**
 * A sessão é restaurada de forma assíncrona. Abrir uma rota protegida como URL
 * inicial faria o app resolvê-la antes da sessão existir e cair na home, por
 * isso autenticamos primeiro e só então navegamos, como no uso real do app.
 */
async function renderAuthenticatedAt(pathname: string) {
  const result = await renderApp('/');
  await screen.findByText(/Olá, Raffael!/);
  await testRouter.push(pathname);
  return result;
}

describe('convites do participante', () => {
  it('abre a lista de convites pelo acesso da home', async () => {
    storeSession();
    api.listInvitations.mockResolvedValue([]);

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Ver convites'));

    await waitFor(() => expect(screen).toHavePathname('/invitations'));
    expect(
      await screen.findByText(/Você não tem convites disponíveis/),
    ).toBeTruthy();
  });

  it('mostra carregamento e separa pendentes de decisões registradas', async () => {
    storeSession();
    let resolveList:
      | ((value: StudyInvitationSummary[]) => void)
      | undefined;
    api.listInvitations.mockImplementation(
      () =>
        new Promise<StudyInvitationSummary[]>((resolve) => {
          resolveList = resolve;
        }),
    );

    await renderAuthenticatedAt('/invitations');

    expect(await screen.findByText('Carregando convites…')).toBeTruthy();

    await act(async () => {
      resolveList?.([pendingSummary, grantedSummary]);
    });

    expect(
      await screen.findByText('Estudo de hábitos de sono'),
    ).toBeTruthy();
    expect(screen.getByText('Estudo de acompanhamento')).toBeTruthy();
    expect(screen.getByText('Pendentes')).toBeTruthy();
    expect(screen.getByText('Decisões registradas')).toBeTruthy();
    expect(screen.getByText('Aguardando sua decisão')).toBeTruthy();
    expect(screen.getByText('Consentimento aceito')).toBeTruthy();
    expect(api.listInvitations).toHaveBeenCalledWith(
      'header.payload.signature',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('abre o detalhe pelo candidateId e exibe protocolo e termo', async () => {
    storeSession();
    api.listInvitations.mockResolvedValue([pendingSummary]);
    api.getInvitation.mockResolvedValue(pendingDetail);

    await renderAuthenticatedAt('/invitations');
    await screen.findByText('Estudo de hábitos de sono');

    await fireEvent.press(
      screen.getByLabelText(
        'Estudo de hábitos de sono. Aguardando sua decisão',
      ),
    );

    await waitFor(() =>
      expect(screen).toHavePathname('/invitations/31'),
    );
    expect(
      await screen.findByText(
        'Entender os hábitos de sono dos participantes.',
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Pesquisadora Fictícia/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/17\/11\/2026 a 20\/12\/2026/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Visita de acompanhamento')).toBeTruthy();
    expect(screen.getByText(/Medição do sono/)).toBeTruthy();
    expect(
      screen.getByText(
        'Termo de consentimento simulado para demonstração acadêmica, sem valor legal.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Consentimento simulado para fins acadêmicos, sem validade legal.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Aceitar convite')).toBeTruthy();
    expect(screen.getByText('Recusar convite')).toBeTruthy();
    expect(api.getInvitation).toHaveBeenCalledWith(
      31,
      'header.payload.signature',
      expect.anything(),
    );
    expect(api.decideInvitation).not.toHaveBeenCalled();
  });

  it('exibe aceite já registrado em modo somente leitura, mesmo sem decidedAt', async () => {
    storeSession();
    api.getInvitation.mockResolvedValue({
      ...pendingDetail,
      status: 'GRANTED',
      decidedAt: undefined,
    });

    await renderAuthenticatedAt('/invitations/31');

    expect(
      await screen.findByText(
        'Consentimento aceito. A equipe responsável poderá prosseguir com a avaliação da sua inclusão no estudo.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Consentimento aceito')).toBeTruthy();
    expect(screen.queryByText('Aceitar convite')).toBeNull();
    expect(screen.queryByText('Recusar convite')).toBeNull();
  });

  it('exibe recusa registrada com tratamento neutro', async () => {
    storeSession();
    api.getInvitation.mockResolvedValue({
      ...pendingDetail,
      status: 'DECLINED',
    });

    await renderAuthenticatedAt('/invitations/31');

    expect(
      await screen.findByText(
        'Consentimento recusado. A recusa é uma decisão válida e não poderá ser alterada pelo aplicativo.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Consentimento recusado')).toBeTruthy();
    expect(screen.queryByText('Aceitar convite')).toBeNull();
    expect(screen.queryByText('Recusar convite')).toBeNull();
  });

  it('confirma o aceite e exibe o resultado devolvido pela API', async () => {
    storeSession();
    api.getInvitation.mockResolvedValue(pendingDetail);
    api.decideInvitation.mockResolvedValue({
      ...pendingDetail,
      status: 'GRANTED',
      decidedAt: '2026-11-20T15:30:00.000Z',
    });

    await renderAuthenticatedAt('/invitations/31');
    await screen.findByText('Estudo de hábitos de sono');

    await fireEvent.press(screen.getByText('Aceitar convite'));

    expect(screen.getByText('Confirmar aceite?')).toBeTruthy();
    expect(
      screen.getByText(
        'Você vai aceitar o convite do estudo "Estudo de hábitos de sono". A decisão é única e não poderá ser alterada pelo aplicativo.',
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Aceitar'));

    expect(
      await screen.findByText(
        'Consentimento aceito. A equipe responsável poderá prosseguir com a avaliação da sua inclusão no estudo.',
      ),
    ).toBeTruthy();
    expect(api.decideInvitation).toHaveBeenCalledWith(
      31,
      'GRANTED',
      'header.payload.signature',
    );
    expect(api.decideInvitation).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Aceitar convite')).toBeNull();
    expect(screen.queryByText('Recusar convite')).toBeNull();
    expect(screen.queryByText('Confirmar aceite?')).toBeNull();
  });

  it('confirma a recusa e exibe o resultado neutro', async () => {
    storeSession();
    api.getInvitation.mockResolvedValue(pendingDetail);
    api.decideInvitation.mockResolvedValue({
      ...pendingDetail,
      status: 'DECLINED',
      decidedAt: '2026-11-20T15:35:00.000Z',
    });

    await renderAuthenticatedAt('/invitations/31');
    await screen.findByText('Estudo de hábitos de sono');

    await fireEvent.press(screen.getByText('Recusar convite'));

    expect(screen.getByText('Confirmar recusa?')).toBeTruthy();
    expect(
      screen.getByText(
        'Você vai recusar o convite do estudo "Estudo de hábitos de sono". A recusa é uma decisão válida e não poderá ser alterada pelo aplicativo.',
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Recusar'));

    expect(
      await screen.findByText(
        'Consentimento recusado. A recusa é uma decisão válida e não poderá ser alterada pelo aplicativo.',
      ),
    ).toBeTruthy();
    expect(api.decideInvitation).toHaveBeenCalledWith(
      31,
      'DECLINED',
      'header.payload.signature',
    );
    expect(screen.queryByText('Aceitar convite')).toBeNull();
    expect(screen.queryByText('Recusar convite')).toBeNull();
  });

  it('cancelar a confirmação não envia a decisão', async () => {
    storeSession();
    api.getInvitation.mockResolvedValue(pendingDetail);

    await renderAuthenticatedAt('/invitations/31');
    await screen.findByText('Recusar convite');

    await fireEvent.press(screen.getByText('Recusar convite'));
    expect(screen.getByText('Confirmar recusa?')).toBeTruthy();

    await fireEvent.press(screen.getByText('Cancelar'));

    expect(api.decideInvitation).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirmar recusa?')).toBeNull();
    expect(screen.getByText('Aceitar convite')).toBeTruthy();
    expect(screen.getByText('Recusar convite')).toBeTruthy();
  });

  it('mantém um único envio enquanto a decisão está em andamento', async () => {
    storeSession();
    api.getInvitation.mockResolvedValue(pendingDetail);
    let resolveDecision:
      | ((value: StudyInvitation) => void)
      | undefined;
    api.decideInvitation.mockImplementation(
      () =>
        new Promise<StudyInvitation>((resolve) => {
          resolveDecision = resolve;
        }),
    );

    await renderAuthenticatedAt('/invitations/31');
    await screen.findByText('Aceitar convite');
    await fireEvent.press(screen.getByText('Aceitar convite'));
    await fireEvent.press(screen.getByText('Aceitar'));

    // Durante o envio, o rótulo de confirmação vira indicador e o
    // cancelamento fica bloqueado: não há novo alvo de toque.
    expect(screen.queryByText('Aceitar')).toBeNull();
    expect(screen.getByText('Cancelar')).toBeTruthy();
    expect(api.decideInvitation).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.getByText('Confirmar aceite?')).toBeTruthy();

    await act(async () => {
      resolveDecision?.({
        ...pendingDetail,
        status: 'GRANTED',
        decidedAt: '2026-11-20T15:40:00.000Z',
      });
    });

    expect(await screen.findByText('Consentimento aceito')).toBeTruthy();
    expect(api.decideInvitation).toHaveBeenCalledTimes(1);
  });

  it('não anuncia sucesso quando a API falha e permite reconsultar', async () => {
    storeSession();
    api.getInvitation.mockResolvedValue(pendingDetail);
    api.decideInvitation.mockRejectedValue(new ApiError('falha', 500));

    await renderAuthenticatedAt('/invitations/31');
    await screen.findByText('Aceitar convite');

    await fireEvent.press(screen.getByText('Aceitar convite'));
    await fireEvent.press(screen.getByText('Aceitar'));

    expect(
      await screen.findByText(INVITATION_DECISION_MESSAGES.uncertain),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Consentimento aceito. A equipe responsável poderá prosseguir com a avaliação da sua inclusão no estudo.',
      ),
    ).toBeNull();
    expect(screen.queryByText('Aceitar convite')).toBeNull();
    expect(screen.queryByText('Recusar convite')).toBeNull();
    expect(screen.getByText('Atualizar convite')).toBeTruthy();

    api.getInvitation.mockResolvedValue({
      ...pendingDetail,
      status: 'GRANTED',
      decidedAt: '2026-11-20T15:45:00.000Z',
    });

    await fireEvent.press(screen.getByText('Atualizar convite'));

    expect(
      await screen.findByText(
        'Consentimento aceito. A equipe responsável poderá prosseguir com a avaliação da sua inclusão no estudo.',
      ),
    ).toBeTruthy();
    expect(api.decideInvitation).toHaveBeenCalledTimes(1);
  });

  it('atualiza a lista ao voltar depois de registrar a decisão', async () => {
    storeSession();
    api.listInvitations
      .mockResolvedValueOnce([pendingSummary])
      .mockResolvedValueOnce([
        {
          ...pendingSummary,
          status: 'GRANTED',
          decidedAt: '2026-11-20T15:50:00.000Z',
        },
      ]);
    api.getInvitation.mockResolvedValue(pendingDetail);
    api.decideInvitation.mockResolvedValue({
      ...pendingDetail,
      status: 'GRANTED',
      decidedAt: '2026-11-20T15:50:00.000Z',
    });

    await renderAuthenticatedAt('/invitations');
    await screen.findByText('Estudo de hábitos de sono');

    await fireEvent.press(
      screen.getByLabelText(
        'Estudo de hábitos de sono. Aguardando sua decisão',
      ),
    );
    await waitFor(() =>
      expect(screen).toHavePathname('/invitations/31'),
    );
    await screen.findByText('Aceitar convite');

    await fireEvent.press(screen.getByText('Aceitar convite'));
    await fireEvent.press(screen.getByText('Aceitar'));
    await screen.findByText('Consentimento aceito');

    await fireEvent.press(screen.getByLabelText('Voltar'));

    await waitFor(() => expect(screen).toHavePathname('/invitations'));
    await waitFor(() =>
      expect(api.listInvitations).toHaveBeenCalledTimes(2),
    );
    expect(
      await screen.findByLabelText(
        'Estudo de hábitos de sono. Consentimento aceito',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText(
        'Estudo de hábitos de sono. Aguardando sua decisão',
      ),
    ).toBeNull();
  });

  it('trata lista vazia sem exibir conteúdo falso', async () => {
    storeSession();
    api.listInvitations.mockResolvedValue([]);

    await renderAuthenticatedAt('/invitations');

    expect(
      await screen.findByText(/Você não tem convites disponíveis/),
    ).toBeTruthy();
    expect(screen.queryByText('Pendentes')).toBeNull();
  });

  it('mostra o erro da lista e recupera ao tentar novamente', async () => {
    storeSession();
    api.listInvitations
      .mockRejectedValueOnce(new ApiError('falha', 500))
      .mockResolvedValueOnce([pendingSummary]);

    await renderAuthenticatedAt('/invitations');

    expect(
      await screen.findByText(/Não foi possível carregar seus convites/),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Tentar novamente'));

    expect(
      await screen.findByText('Estudo de hábitos de sono'),
    ).toBeTruthy();
    expect(api.listInvitations).toHaveBeenCalledTimes(2);
  });

  it('trata situação desconhecida como não pendente', async () => {
    storeSession();
    api.listInvitations.mockResolvedValue([
      { ...pendingSummary, status: 'ACTIVE' },
    ]);

    await renderAuthenticatedAt('/invitations');

    expect(await screen.findByText('Outros convites')).toBeTruthy();
    expect(screen.getByText('Situação não reconhecida')).toBeTruthy();
    expect(screen.getByText('Nenhum convite aguardando decisão.')).toBeTruthy();
  });

  it('mostra mensagem genérica quando o detalhe não está disponível', async () => {
    storeSession();
    api.getInvitation.mockRejectedValue(
      new ApiError('não encontrado', 404, 'NOT_FOUND'),
    );

    await renderAuthenticatedAt('/invitations/31');

    expect(
      await screen.findByText(INVITATION_MESSAGES.notAvailable),
    ).toBeTruthy();
    expect(screen.getByText('Tentar novamente')).toBeTruthy();
  });

  it('não consulta a API quando o identificador da rota é inválido', async () => {
    storeSession();

    await renderAuthenticatedAt('/invitations/abc');

    expect(
      await screen.findByText(INVITATION_MESSAGES.invalidId),
    ).toBeTruthy();
    expect(api.getInvitation).not.toHaveBeenCalled();
  });

  it('bloqueia convites sem sessão e mantém o login', async () => {
    await renderApp('/invitations');

    expect(await screen.findByText('Login')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(api.listInvitations).not.toHaveBeenCalled();
  });
});
