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

type StoredSessionParse =
  | { kind: 'session'; session: AuthSession }
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
  async function clearQuietly(): Promise<void> {
    try {
      await adapter.deleteItemAsync(SESSION_STORAGE_KEY);
    } catch {
      // Um registro inválido não pode impedir a interface de seguir para o login.
    }
  }

  return {
    async read(): Promise<SessionReadResult> {
      let available: boolean;
      try {
        available = await adapter.isAvailableAsync();
      } catch {
        return { status: 'invalid', reason: 'unavailable' };
      }
      if (!available) {
        return { status: 'invalid', reason: 'unavailable' };
      }

      let raw: string | null;
      try {
        raw = await adapter.getItemAsync(SESSION_STORAGE_KEY);
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
        await adapter.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(record));
      } catch {
        throw new SessionPersistenceError('write');
      }
    },

    async clear(): Promise<void> {
      try {
        await adapter.deleteItemAsync(SESSION_STORAGE_KEY);
      } catch {
        throw new SessionPersistenceError('clear');
      }
    },
  };
}
