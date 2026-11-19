import { ApiError, apiRequest } from '../services/api/apiClient';

describe('apiRequest', () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalBaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
    }
  });

  it('uses detail from application/problem+json error responses', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:8080/api';

    const problem = {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'O e-mail informado já está cadastrado.',
    };
    const json = jest.fn().mockResolvedValue(problem);
    const text = jest.fn();
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      headers: {
        get: jest.fn().mockReturnValue('application/problem+json; charset=utf-8'),
      },
      json,
      text,
    } as unknown as Response);

    await expect(apiRequest('/users')).rejects.toMatchObject({
      name: 'ApiError',
      message: problem.detail,
      status: 400,
    } satisfies Partial<ApiError>);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8080/api/users',
      expect.anything(),
    );
    expect(json).toHaveBeenCalledTimes(1);
    expect(text).not.toHaveBeenCalled();
  });

  it('keeps a 401 without a readable body as an ApiError', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:8080/api';

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      headers: {
        get: jest.fn().mockReturnValue('application/json'),
      },
      json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      text: jest.fn(),
    } as unknown as Response);

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    } satisfies Partial<ApiError>);
  });
});
