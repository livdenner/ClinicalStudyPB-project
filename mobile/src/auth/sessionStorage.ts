import { expoSecureStoreAdapter } from './expoSecureStoreAdapter';
import { createSecureSessionStorage } from './secureSessionStorage';

/** Instância da sessão usada pelo aplicativo em execução. */
export const sessionStorage = createSecureSessionStorage(expoSecureStoreAdapter);
