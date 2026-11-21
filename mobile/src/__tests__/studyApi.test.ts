import { ApiError } from '../services/api/apiClient';
import {
  InvalidStudiesResponseError,
  listMyStudies,
} from '../services/studies/studyApi';
import type { ParticipantStudy } from '../services/studies/studyTypes';

const BASE_URL = 'http://localhost:8080/api';

const activeStudy: ParticipantStudy = {
  participantId: 4,
  studyId: 1,
  studyTitle: 'Acompanhamento de hipertensão',
  studyObjective: 'Avaliar a adesão ao acompanhamento fictício',
  studyStatus: 'EXECUTION',
  startDate: '2027-01-01',
  endDate: '2027-12-31',
  responsibleName: 'Paula Pesquisadora',
  participationStatus: 'ACTIVE',
  includedAt: '2026-11-10T14:00:00Z',
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
          name: 'Coleta inicial',
          description: 'Registro previsto no protocolo.',
          position: 1,
        },
      ],
    },
  ],
};

const withdrawnStudy: ParticipantStudy = {
  participantId: 7,
  studyId: 2,
  studyTitle: 'Estudo de hábitos de sono',
  studyObjective: 'Analisar rotina de descanso',
  studyStatus: 'CANCELLED',
  startDate: '2026-08-01',
  endDate: '2026-12-31',
  responsibleName: 'Carlos Pesquisador',
  participationStatus: 'WITHDRAWN',
  includedAt: '2026-11-05T12:00:00Z',
  withdrawnAt: '2026-11-08T09:30:00Z',
  plannedVisits: [],
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

describe('studyApi', () => {
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

  it('consulta me/studies com Bearer, sinal de cancelamento e sem parâmetros de conta', async () => {
    const controller = new AbortController();
    const payload = [withdrawnStudy, activeStudy];
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, payload));

    await expect(
      listMyStudies('token-abc', controller.signal),
    ).resolves.toEqual(payload);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(url).toBe(`${BASE_URL}/me/studies`);
    expect(url).not.toContain('/api/api');
    expect(url).not.toContain('userId');
    expect(url).not.toContain('participantId');
    expect(init?.method).toBeUndefined();
    expect(init?.signal).toBe(controller.signal);
    expect(headers.get('Authorization')).toBe('Bearer token-abc');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('aceita lista vazia como array direto', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, []));

    await expect(listMyStudies('token-abc')).resolves.toEqual([]);
  });

  it('rejeita payload que não seja array de estudos válidos', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    fetchSpy.mockResolvedValueOnce(mockResponse(200, { content: [] }));
    await expect(listMyStudies('token-abc')).rejects.toBeInstanceOf(
      InvalidStudiesResponseError,
    );

    fetchSpy.mockResolvedValueOnce(mockResponse(200, null));
    await expect(listMyStudies('token-abc')).rejects.toBeInstanceOf(
      InvalidStudiesResponseError,
    );

    const { plannedVisits: _omitted, ...withoutPlannedVisits } = activeStudy;
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, [withoutPlannedVisits]),
    );
    await expect(listMyStudies('token-abc')).rejects.toBeInstanceOf(
      InvalidStudiesResponseError,
    );
  });

  it('propaga erros HTTP sem convertê-los em lista vazia', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(
        403,
        {
          code: 'FORBIDDEN',
          detail: 'Acesso negado.',
        },
        'application/problem+json',
      ),
    );

    await expect(listMyStudies('token-abc')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'FORBIDDEN',
    } satisfies Partial<ApiError>);
  });

  it('não faz requisição quando o token está em branco', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(listMyStudies('   ')).rejects.toThrow(
      'Token de acesso ausente.',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
