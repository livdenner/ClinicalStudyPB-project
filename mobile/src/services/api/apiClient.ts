/** Erro de validação associado a um campo, conforme o formato esperado da API. */
export interface ApiFieldError {
  field: string;
  message: string;
}

/** Campos opcionais lidos do corpo de uma resposta HTTP de erro. */
interface ApiErrorResponse {
  code?: string;
  message?: string;
  detail?: string;
  fieldErrors?: ApiFieldError[];
}

/** Opções de fetch com `body` aceito como valor JavaScript serializável em JSON. */
export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/** Erro HTTP estruturado para a interface tratar status e erros de validação. */
export class ApiError extends Error {
  /**
   * @param message Mensagem legível para diagnóstico ou apresentação ao usuário.
   * @param status Código HTTP da resposta.
   * @param code Código de erro opcional definido pelo backend.
   * @param fieldErrors Erros de validação por campo, se enviados pela API.
   */
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly fieldErrors: ApiFieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getApiBaseUrl(): string {
  let baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      'Defina EXPO_PUBLIC_API_BASE_URL no arquivo .env do aplicativo mobile.',
    );
  }

  while (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  return baseUrl;
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
  if (mediaType === 'application/json' || mediaType.endsWith('+json')) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : undefined;
}

/**
 * Faz uma requisição JSON à API configurada em `EXPO_PUBLIC_API_BASE_URL`.
 * O caminho é relativo à base, o corpo é serializado como JSON e respostas HTTP
 * fora de 2xx são convertidas em `ApiError`. O chamador pode enviar cabeçalhos
 * de autenticação, mas este cliente não gerencia sessão nem tokens.
 *
 * @typeParam T Tipo esperado para o corpo de resposta bem-sucedido.
 * @param path Caminho relativo à URL base, com ou sem barra inicial.
 * @param options Opções de `fetch`; `body`, quando informado, será serializado como JSON.
 * @returns O corpo da resposta convertido para `T` (ou `undefined` em HTTP 204).
 * @throws {Error} Se `EXPO_PUBLIC_API_BASE_URL` não estiver configurada.
 * @throws {ApiError} Se a API responder com status fora de 2xx.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  const response = await fetch(getApiBaseUrl() + '/' + relativePath, {
    ...requestOptions,
    headers,
    body: requestBody,
  });
  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    const error = (
      responseBody !== null && typeof responseBody === 'object'
        ? responseBody
        : {}
    ) as ApiErrorResponse;

    throw new ApiError(
      error.message ||
        error.detail ||
        'A API respondeu com status ' + response.status + '.',
      response.status,
      error.code,
      error.fieldErrors ?? [],
    );
  }

  return responseBody as T;
}
