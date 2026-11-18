import type { AuthSession } from '../auth/session';
import {
  createSecureSessionStorage,
  SESSION_RECORD_VERSION,
  SESSION_STORAGE_KEY,
  SessionPersistenceError,
  type SecureStorageAdapter,
} from '../auth/secureSessionStorage';

const session: AuthSession = {
  accessToken: 'header.payload.signature',
  expiresAt: 1_800_000_000_000,
  user: {
    id: 10,
    name: 'Participante Fictício',
    email: 'participante@exemplo.test',
    role: 'PARTICIPANT',
    active: true,
    mustChangePassword: true,
  },
};

class FakeSecureStorage implements SecureStorageAdapter {
  available = true;
  failAvailability = false;
  entries = new Map<string, string>();
  deletedKeys: string[] = [];
  getError: Error | null = null;
  setError: Error | null = null;
  deleteError: Error | null = null;
  transientGetFailures = 0;
  transientSetFailures = 0;
  transientDeleteFailures = 0;

  async isAvailableAsync(): Promise<boolean> {
    if (this.failAvailability) {
      throw new Error('falha nativa');
    }
    return this.available;
  }

  async getItemAsync(key: string): Promise<string | null> {
    if (this.transientGetFailures > 0) {
      this.transientGetFailures -= 1;
      throw new Error('falha transitória de leitura');
    }
    if (this.getError) {
      throw this.getError;
    }
    return this.entries.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    if (this.transientSetFailures > 0) {
      this.transientSetFailures -= 1;
      throw new Error('falha transitória de gravação');
    }
    if (this.setError) {
      throw this.setError;
    }
    this.entries.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    if (this.transientDeleteFailures > 0) {
      this.transientDeleteFailures -= 1;
      throw new Error('falha transitória de remoção');
    }
    if (this.deleteError) {
      throw this.deleteError;
    }
    this.deletedKeys.push(key);
    this.entries.delete(key);
  }
}

function storedRecord(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: SESSION_RECORD_VERSION,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    user: session.user,
    ...overrides,
  });
}

describe('armazenamento seguro da sessão', () => {
  it('saves and restores the session with a versioned record', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);

    await storage.save(session);

    const raw = adapter.entries.get(SESSION_STORAGE_KEY);
    expect(raw).toBeDefined();
    const record = JSON.parse(String(raw)) as Record<string, unknown>;
    expect(Object.keys(record).sort()).toEqual([
      'accessToken',
      'expiresAt',
      'user',
      'version',
    ]);
    expect(record.version).toBe(SESSION_RECORD_VERSION);
    expect(await storage.read()).toEqual({ status: 'restored', session });
  });

  it('reports an empty storage without failing', async () => {
    const storage = createSecureSessionStorage(new FakeSecureStorage());

    expect(await storage.read()).toEqual({ status: 'empty' });
  });

  it('reports unavailable storage without trying to read a value', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.available = false;
    adapter.entries.set(SESSION_STORAGE_KEY, storedRecord());

    expect(await storage.read()).toEqual({
      status: 'invalid',
      reason: 'unavailable',
    });
    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(true);
  });

  it('reports a native availability failure as unavailable', async () => {
    const adapter = new FakeSecureStorage();
    adapter.failAvailability = true;
    const storage = createSecureSessionStorage(adapter);

    expect(await storage.read()).toEqual({
      status: 'invalid',
      reason: 'unavailable',
    });
  });

  it('discards corrupted JSON and continues safely', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.entries.set(SESSION_STORAGE_KEY, '{nao-e-json');

    expect(await storage.read()).toEqual({
      status: 'invalid',
      reason: 'corrupted',
    });
    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(false);
    expect(adapter.deletedKeys).toContain(SESSION_STORAGE_KEY);
  });

  it('discards a record from an unsupported version', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.entries.set(
      SESSION_STORAGE_KEY,
      storedRecord({ version: SESSION_RECORD_VERSION + 1 }),
    );

    expect(await storage.read()).toEqual({
      status: 'invalid',
      reason: 'unsupported-version',
    });
    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('discards records with a non-numeric version', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.entries.set(SESSION_STORAGE_KEY, storedRecord({ version: '1' }));

    expect(await storage.read()).toEqual({
      status: 'invalid',
      reason: 'corrupted',
    });
    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('discards a record with invalid user metadata', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.entries.set(
      SESSION_STORAGE_KEY,
      storedRecord({
        user: { ...session.user, role: 'UNKNOWN' },
      }),
    );

    expect(await storage.read()).toEqual({
      status: 'invalid',
      reason: 'corrupted',
    });
    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('discards a record with an invalid expiration', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.entries.set(
      SESSION_STORAGE_KEY,
      storedRecord({ expiresAt: 'amanha' }),
    );

    expect(await storage.read()).toEqual({
      status: 'invalid',
      reason: 'corrupted',
    });
  });

  it('reports a read failure without trying to clear the entry', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.getError = new Error('keychain indisponível');

    expect(await storage.read()).toEqual({
      status: 'invalid',
      reason: 'storage-error',
    });
    expect(adapter.deletedKeys).toEqual([]);
  });

  it('throws a typed error when the session cannot be saved', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.setError = new Error('disco cheio');

    await expect(storage.save(session)).rejects.toMatchObject({
      name: 'SessionPersistenceError',
      operation: 'write',
    } satisfies Partial<SessionPersistenceError>);
  });

  it('repete uma leitura que falha de forma transitória', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.entries.set(SESSION_STORAGE_KEY, storedRecord());
    adapter.transientGetFailures = 1;

    expect(await storage.read()).toEqual({ status: 'restored', session });
  });

  it('repete uma gravação que falha de forma transitória', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.transientSetFailures = 1;

    await storage.save(session);

    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(true);
    expect(await storage.read()).toEqual({ status: 'restored', session });
  });

  it('repete uma remoção que falha de forma transitória', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    await storage.save(session);
    adapter.transientDeleteFailures = 1;

    await storage.clear();

    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('revoga o registro quando a remoção falha de forma persistente', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    await storage.save(session);
    adapter.deleteError = new Error('keychain bloqueado');

    await storage.clear();

    const raw = String(adapter.entries.get(SESSION_STORAGE_KEY));
    expect(JSON.parse(raw)).toEqual({
      version: SESSION_RECORD_VERSION,
      revoked: true,
    });
    expect(raw).not.toContain(session.accessToken);

    adapter.deleteError = null;
    expect(await storage.read()).toEqual({ status: 'empty' });
    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('trata um registro revogado como armazenamento vazio', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    adapter.entries.set(
      SESSION_STORAGE_KEY,
      JSON.stringify({ version: SESSION_RECORD_VERSION, revoked: true }),
    );

    expect(await storage.read()).toEqual({ status: 'empty' });
    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('falha na limpeza somente quando remoção e revogação falham', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    await storage.save(session);
    adapter.deleteError = new Error('keychain indisponível');
    adapter.setError = new Error('keychain indisponível');

    await expect(storage.clear()).rejects.toMatchObject({
      name: 'SessionPersistenceError',
      operation: 'clear',
    } satisfies Partial<SessionPersistenceError>);
  });

  it('removes the stored session', async () => {
    const adapter = new FakeSecureStorage();
    const storage = createSecureSessionStorage(adapter);
    await storage.save(session);

    await storage.clear();

    expect(adapter.entries.has(SESSION_STORAGE_KEY)).toBe(false);
    expect(await storage.read()).toEqual({ status: 'empty' });
  });
});
