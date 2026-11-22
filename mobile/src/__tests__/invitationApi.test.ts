import { ApiError } from '../services/api/apiClient';
import {
  decideInvitation,
  getInvitation,
  listInvitations,
} from '../services/invitations/invitationApi';
import type {
  StudyInvitation,
  StudyInvitationSummary,
} from '../services/invitations/invitationTypes';

const BASE_URL = 'http://localhost:8080/api';

const summary: StudyInvitationSummary = {
  candidateId: 31,
  studyId: 8,
  studyTitle: 'Estudo de hábitos de sono',
  status: 'CONSENT_PENDING',
};

const detail: StudyInvitation = {
  ...summary,
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

function mockResponse(
  status: number,
  body: unknown,
  contentType = 'application/json',
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: jest.fn().mockReturnValue(contentType) },
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response;
}

function readBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe('invitationApi', () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalBaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
    }
  });

  it('lista os convites em me/invitations com Bearer e sem duplicar /api', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, [summary]));

    await expect(listInvitations('token-abc')).resolves.toEqual([summary]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(url).toBe(`${BASE_URL}/me/invitations`);
    expect(init?.method).toBeUndefined();
    expect(headers.get('Authorization')).toBe('Bearer token-abc');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('filtra pendentes no servidor sem montar o caminho à mão', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, [summary]));

    await listInvitations('token-abc', { status: 'CONSENT_PENDING' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/me/invitations?status=CONSENT_PENDING`);
  });

  it('consulta o detalhe pelo candidateId e encaminha o sinal de cancelamento', async () => {
    const controller = new AbortController();
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, detail));

    await expect(
      getInvitation(31, 'token-abc', controller.signal),
    ).resolves.toEqual(detail);

    const [url, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(url).toBe(`${BASE_URL}/me/invitations/31`);
    expect(headers.get('Authorization')).toBe('Bearer token-abc');
    expect(init?.signal).toBe(controller.signal);
  });

  it('recusa identificadores inválidos antes de chamar a API', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(getInvitation(0, 'token-abc')).rejects.toThrow(
      'Identificador de convite inválido.',
    );
    await expect(getInvitation(1.5, 'token-abc')).rejects.toThrow(
      'Identificador de convite inválido.',
    );
    await expect(
      decideInvitation(Number.NaN, 'GRANTED', 'token-abc'),
    ).rejects.toThrow('Identificador de convite inválido.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envia GRANTED e DECLINED no corpo da decisão', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, detail));

    await decideInvitation(31, 'GRANTED', 'token-abc');
    await decideInvitation(31, 'DECLINED', 'token-abc');

    const [firstUrl, firstInit] = fetchSpy.mock.calls[0];
    expect(firstUrl).toBe(`${BASE_URL}/me/invitations/31/decision`);
    expect(firstInit?.method).toBe('POST');
    expect(readBody(firstInit)).toEqual({ status: 'GRANTED' });

    const [secondUrl, secondInit] = fetchSpy.mock.calls[1];
    expect(secondUrl).toBe(`${BASE_URL}/me/invitations/31/decision`);
    expect(readBody(secondInit)).toEqual({ status: 'DECLINED' });
  });

  it('preserva o código de conflito de um problem+json', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(
        409,
        {
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'O consentimento já foi decidido.',
          code: 'CONSENT_ALREADY_DECIDED',
        },
        'application/problem+json',
      ),
    );

    await expect(
      decideInvitation(31, 'GRANTED', 'token-abc'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'CONSENT_ALREADY_DECIDED',
    } satisfies Partial<ApiError>);
  });

  it('não faz requisição sem token', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(listInvitations('   ')).rejects.toThrow(
      'Token de acesso ausente.',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
