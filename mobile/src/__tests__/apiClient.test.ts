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
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:8080/api/v1';

    const problem = {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'O e-mail informado já está cadastrado.',
    };
    const json = jest.fn().mockResolvedValue(problem);
    const text = jest.fn();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
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
    expect(json).toHaveBeenCalledTimes(1);
    expect(text).not.toHaveBeenCalled();
  });
});
