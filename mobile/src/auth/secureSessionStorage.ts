import {
  isPlainObject,
  parseAuthUser,
  type AuthSession,
} from './session';

/** Chave única do registro de sessão no armazenamento seguro. */
export const SESSION_STORAGE_KEY = 'clinicalstudypb.session.v1';

/** Versão do registro persistido; permite descartar formatos antigos. */
export const SESSION_RECORD_VERSION = 1;

/**
 * Tentativas por operação nativa. O SecureStore pode falhar de forma
 * transitória (keychain ocupado, biometria ainda inicializando); uma segunda
 * tentativa recupera esses casos sem atrasar perceptivelmente o fluxo.
 */
const NATIVE_OPERATION_ATTEMPTS = 2;

/**
 * Operações mínimas do armazenamento seguro. A interface permite substituir
 * o SecureStore por uma implementação de teste sem carregar o módulo nativo.
 */
export interface SecureStorageAdapter {
  isAvailableAsync(): Promise<boolean>;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** Motivos pelos quais uma sessão persistida não pode ser restaurada. */
export type SessionReadFailureReason =
  | 'unavailable'
  | 'corrupted'
  | 'unsupported-version'
  | 'storage-error';

/** Resultado de uma tentativa de leitura da sessão persistida. */
export type SessionReadResult =
  | { status: 'restored'; session: AuthSession }
  | { status: 'empty' }
  | { status: 'invalid'; reason: SessionReadFailureReason };

/** Contrato de leitura, gravação e remoção da sessão. */
export interface SessionStorage {
  read(): Promise<SessionReadResult>;
  save(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}

/** Falha ao gravar ou remover a sessão no armazenamento seguro. */
export class SessionPersistenceError extends Error {
  constructor(readonly operation: 'write' | 'clear') {
    super(
      operation === 'write'
        ? 'Não foi possível salvar a sessão no armazenamento seguro.'
        : 'Não foi possível remover a sessão do armazenamento seguro.',
    );
    this.name = 'SessionPersistenceError';
  }
}

interface StoredSessionRecordV1 {
  version: typeof SESSION_RECORD_VERSION;
  accessToken: string;
  expiresAt: number;
  user: AuthSession['user'];
}

/**
 * Registro gravado no lugar da sessão quando a remoção nativa falha. Não
 * contém token e faz a próxima leitura tratar o armazenamento como vazio.
 */
const REVOKED_SESSION_RECORD = JSON.stringify({
  version: SESSION_RECORD_VERSION,
  revoked: true,
});

type StoredSessionParse =
  | { kind: 'session'; session: AuthSession }
  | { kind: 'revoked' }
  | { kind: 'corrupted' }
  | { kind: 'unsupported-version' };

function parseStoredSession(raw: string): StoredSessionParse {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { kind: 'corrupted' };
  }

  if (!isPlainObject(value) || typeof value.version !== 'number') {
    return { kind: 'corrupted' };
  }
  if (value.version !== SESSION_RECORD_VERSION) {
    return { kind: 'unsupported-version' };
  }
  if (value.revoked === true) {
    return { kind: 'revoked' };
  }

  const user = parseAuthUser(value.user);
  if (
    typeof value.accessToken !== 'string' ||
    value.accessToken.length === 0 ||
    typeof value.expiresAt !== 'number' ||
    !Number.isFinite(value.expiresAt) ||
    value.expiresAt <= 0 ||
    user === null
  ) {
    return { kind: 'corrupted' };
  }

  return {
    kind: 'session',
    session: {
      accessToken: value.accessToken,
      expiresAt: value.expiresAt,
      user,
    },
  };
}

/**
 * Cria o armazenamento da sessão sobre um adaptador de armazenamento seguro.
 * Nenhuma senha, código de ativação ou outro dado sensível além do token e
 * dos metadados mínimos é gravado.
 */
export function createSecureSessionStorage(
  adapter: SecureStorageAdapter,
): SessionStorage {
  async function runWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < NATIVE_OPERATION_ATTEMPTS; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async function removeRecord(): Promise<void> {
    try {
      await runWithRetry(() => adapter.deleteItemAsync(SESSION_STORAGE_KEY));
      return;
    } catch {
      // A remoção pode falhar de forma persistente, por exemplo com o
      // armazenamento temporariamente bloqueado. Sobrescrever o registro com
      // uma marca de revogação impede que a sessão antiga volte a ser
      // restaurada na próxima abertura do aplicativo.
    }

    await runWithRetry(() =>
      adapter.setItemAsync(SESSION_STORAGE_KEY, REVOKED_SESSION_RECORD),
    );
  }

  async function clearQuietly(): Promise<void> {
    try {
      await removeRecord();
    } catch {
      // Um registro inválido não pode impedir a interface de seguir para o login.
    }
  }

  return {
    async read(): Promise<SessionReadResult> {
      let available: boolean;
      try {
        available = await runWithRetry(() => adapter.isAvailableAsync());
      } catch {
        return { status: 'invalid', reason: 'unavailable' };
      }
      if (!available) {
        return { status: 'invalid', reason: 'unavailable' };
      }

      let raw: string | null;
      try {
        raw = await runWithRetry(() => adapter.getItemAsync(SESSION_STORAGE_KEY));
      } catch {
        return { status: 'invalid', reason: 'storage-error' };
      }

      if (raw === null || raw.length === 0) {
        return { status: 'empty' };
      }

      const parsed = parseStoredSession(raw);
      if (parsed.kind === 'session') {
        return { status: 'restored', session: parsed.session };
      }

      await clearQuietly();

      if (parsed.kind === 'revoked') {
        return { status: 'empty' };
      }

      return {
        status: 'invalid',
        reason:
          parsed.kind === 'unsupported-version'
            ? 'unsupported-version'
            : 'corrupted',
      };
    },

    async save(session: AuthSession): Promise<void> {
      const record: StoredSessionRecordV1 = {
        version: SESSION_RECORD_VERSION,
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        user: session.user,
      };

      try {
        await runWithRetry(() =>
          adapter.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(record)),
        );
      } catch {
        throw new SessionPersistenceError('write');
      }
    },

    async clear(): Promise<void> {
      try {
        await removeRecord();
      } catch {
        throw new SessionPersistenceError('clear');
      }
    },
  };
}
