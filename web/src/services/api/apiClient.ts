export type ApiFieldError = {
  field: string;
  message: string;
};

export class ApiClientError extends Error {
  readonly status: number | null;
  readonly code?: string;
  readonly fieldErrors: ApiFieldError[];

  constructor(
    message: string,
    options: {
      status?: number | null;
      code?: string;
      fieldErrors?: ApiFieldError[];
    } = {},
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status ?? null;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? [];
  }
}

type ApiErrorResponse = {
  code?: unknown;
  message?: unknown;
  detail?: unknown;
  title?: unknown;
  fieldErrors?: unknown;
};

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function getFieldErrors(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): ApiFieldError[] => {
    if (
      typeof item === "object" &&
      item !== null &&
      "field" in item &&
      "message" in item &&
      typeof item.field === "string" &&
      typeof item.message === "string"
    ) {
      return [{ field: item.field, message: item.message }];
    }

    return [];
  });
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toApiClientError(body: unknown, status: number): ApiClientError {
  const payload =
    typeof body === "object" && body !== null
      ? (body as ApiErrorResponse)
      : undefined;
  const message =
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.detail === "string" && payload.detail) ||
    (typeof payload?.title === "string" && payload.title) ||
    (typeof body === "string" && body) ||
    `A requisição falhou (HTTP ${status}).`;

  return new ApiClientError(message, {
    status,
    code: typeof payload?.code === "string" ? payload.code : undefined,
    fieldErrors: getFieldErrors(payload?.fieldErrors),
  });
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, token, headers: requestHeaders, ...requestOptions } = options;
  const headers = new Headers(requestHeaders);
  headers.set("Accept", "application/json");

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      ...requestOptions,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw cause;
    }

    throw new ApiClientError("Não foi possível conectar à API.");
  }

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw toApiClientError(responseBody, response.status);
  }

  return responseBody as T;
}
