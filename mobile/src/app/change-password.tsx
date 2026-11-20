import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '../auth/AuthProvider';
import {
  toPasswordChangeRequest,
  type PasswordFormValues,
  type PasswordMode,
} from '../auth/passwordPolicy';
import { ActionButton } from '../components/ActionButton';
import { BrandHeader } from '../components/BrandHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MessageBanner } from '../components/MessageBanner';
import { ScreenContainer } from '../components/ScreenContainer';
import { PasswordForm } from '../components/auth/PasswordForm';
import { AUTH_MESSAGES } from '../services/auth/authErrors';
import { colors, spacing } from '../theme/colors';

/**
 * Define a senha inicial de um acesso restrito ou troca a senha de uma conta
 * ativa. A sessão devolvida pela API substitui a anterior antes de ir ao início.
 */
export default function ChangePasswordScreen() {
  const { session, changePassword, signOut } = useSession();
  const [restricted] = useState(session?.user.mustChangePassword === true);
  const [mode] = useState<PasswordMode>(restricted ? 'initial' : 'change');
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [completed, setCompleted] = useState(false);

  // A sessão nova já liberou o início; a troca de rota só ocorre depois que a
  // navegação reflete o novo perfil, evitando um destino ainda protegido.
  useEffect(() => {
    if (completed) {
      router.replace('/');
    }
  }, [completed]);

  if (session === null) {
    return null;
  }

  async function submit(values: PasswordFormValues): Promise<void> {
    await changePassword(toPasswordChangeRequest(mode, values));
    setCompleted(true);
  }

  async function confirmSignOut(): Promise<void> {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    await signOut();
  }

  return (
    <ScreenContainer>
      <BrandHeader />

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {restricted ? 'Defina sua nova senha' : 'Trocar senha'}
        </Text>
        <Text style={styles.subtitle}>
          {restricted
            ? 'Para continuar, crie uma senha pessoal de acesso ao aplicativo.'
            : 'Atualize a senha de acesso à sua conta.'}
        </Text>
        <Text style={styles.account}>{session.user.email}</Text>
      </View>

      {restricted ? (
        <MessageBanner
          message={AUTH_MESSAGES.passwordChangeRequired}
          tone="info"
        />
      ) : null}

      <PasswordForm
        mode={mode}
        onSubmit={submit}
        submitLabel={restricted ? 'Definir senha' : 'Salvar nova senha'}
      />

      {restricted ? (
        <ActionButton
          label="Sair"
          onPress={() => setConfirmingSignOut(true)}
          variant="secondary"
        />
      ) : (
        <ActionButton
          label="Voltar"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          variant="secondary"
        />
      )}

      <ConfirmDialog
        confirmLabel="Sair da conta"
        loading={signingOut}
        message="Para acessar seus estudos novamente, entre com o e-mail e a senha."
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => {
          void confirmSignOut();
        }}
        title="Deseja sair da sua conta?"
        visible={confirmingSignOut}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  account: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
