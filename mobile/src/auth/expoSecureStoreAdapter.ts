import * as SecureStore from 'expo-secure-store';

import type { SecureStorageAdapter } from './secureSessionStorage';

/**
 * Adaptador de produção baseado em `expo-secure-store`, usando apenas as APIs
 * assíncronas. A sessão fica no armazenamento seguro do dispositivo; na web,
 * onde o SecureStore não está disponível, a leitura informa `unavailable`.
 */
export const expoSecureStoreAdapter: SecureStorageAdapter = {
  isAvailableAsync: () => SecureStore.isAvailableAsync(),
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
};
