/**
 * Monta o cabeçalho `Authorization` a partir do token da sessão atual.
 * O token não é registrado nem incluído em parâmetros de navegação.
 *
 * @param accessToken Token recebido do provider de sessão.
 * @returns Cabeçalho pronto para ser enviado ao cliente HTTP.
 * @throws {Error} Se o token estiver vazio.
 */
export function bearerHeader(accessToken: string): Record<string, string> {
  const token = accessToken.trim();
  if (token.length === 0) {
    throw new Error('Token de acesso ausente.');
  }
  return { Authorization: `Bearer ${token}` };
}
