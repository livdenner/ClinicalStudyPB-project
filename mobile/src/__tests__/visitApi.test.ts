import { ApiError } from '../services/api/apiClient';
import {
  getMyVisits,
  InvalidVisitsResponseError,
} from '../services/visits/visitApi';
import type {
  ParticipantVisit,
  ParticipantVisits,
} from '../services/visits/visitTypes';

const BASE_URL = 'http://localhost:8080/api';

const upcomingVisit: ParticipantVisit = {
  id: 15,
  studyId: 1,
  studyTitle: 'Acompanhamento de hipertensão',
  participantId: 4,
  plannedVisitId: 3,
  plannedVisitName: 'Retorno',
  scheduledAt: '2027-03-10T12:00:00Z',
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

const cancelledVisit: ParticipantVisit = {
  id: 12,
  studyId: 1,
  studyTitle: 'Acompanhamento de hipertensão',
  participantId: 4,
  plannedVisitId: 2,
  plannedVisitName: 'Avaliação inicial',
  scheduledAt: '2027-02-01T12:00:00Z',
  status: 'CANCELLED',
  outcomeAt: '2027-01-20T13:00:00Z',
  cancellationReason: 'Participante pediu para remarcar',
  activities: [],
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

describe('visitApi', () => {
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

  it('consulta me/visits com Bearer, sinal de cancelamento e sem parâmetros de conta', async () => {
    const controller = new AbortController();
    const payload: ParticipantVisits = {
      upcoming: [upcomingVisit],
      history: [cancelledVisit],
    };
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, payload));

    await expect(
      getMyVisits('token-abc', controller.signal),
    ).resolves.toEqual(payload);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(url).toBe(`${BASE_URL}/me/visits`);
    expect(url).not.toContain('/api/api');
    expect(url).not.toContain('userId');
    expect(url).not.toContain('participantId');
    expect(init?.method).toBeUndefined();
    expect(init?.signal).toBe(controller.signal);
    expect(headers.get('Authorization')).toBe('Bearer token-abc');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('aceita listas vazias quando upcoming e history são arrays', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, { upcoming: [], history: [] }));

    await expect(getMyVisits('token-abc')).resolves.toEqual({
      upcoming: [],
      history: [],
    });
  });

  it('rejeita payloads fora do contrato de me/visits', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    fetchSpy.mockResolvedValueOnce(mockResponse(200, []));
    await expect(getMyVisits('token-abc')).rejects.toBeInstanceOf(
      InvalidVisitsResponseError,
    );

    fetchSpy.mockResolvedValueOnce(mockResponse(200, null));
    await expect(getMyVisits('token-abc')).rejects.toBeInstanceOf(
      InvalidVisitsResponseError,
    );

    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, { upcoming: [upcomingVisit] }),
    );
    await expect(getMyVisits('token-abc')).rejects.toBeInstanceOf(
      InvalidVisitsResponseError,
    );

    const { activities: _omitted, ...withoutActivities } = upcomingVisit;
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, { upcoming: [withoutActivities], history: [] }),
    );
    await expect(getMyVisits('token-abc')).rejects.toBeInstanceOf(
      InvalidVisitsResponseError,
    );

    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, {
        upcoming: [
          {
            ...upcomingVisit,
            activities: [{ ...upcomingVisit.activities[0], position: 0 }],
          },
        ],
        history: [],
      }),
    );
    await expect(getMyVisits('token-abc')).rejects.toBeInstanceOf(
      InvalidVisitsResponseError,
    );
  });

  it('propaga erros HTTP sem convertê-los em listas vazias', async () => {
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

    await expect(getMyVisits('token-abc')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'FORBIDDEN',
    } satisfies Partial<ApiError>);
  });

  it('não faz requisição quando o token está em branco', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(getMyVisits('   ')).rejects.toThrow(
      'Token de acesso ausente.',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
