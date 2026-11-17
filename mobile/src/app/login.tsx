import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  hasLoginFormErrors,
  validateLoginForm,
  type LoginFormErrors,
} from '../auth/loginForm';
import { useSession } from '../auth/AuthProvider';
import { BrandHeader } from '../components/BrandHeader';
import { ActionButton } from '../components/ActionButton';
import { MessageBanner } from '../components/MessageBanner';
import { ScreenContainer } from '../components/ScreenContainer';
import { TextField } from '../components/TextField';
import { getAuthErrorMessage } from '../services/auth/authErrors';
import { colors, radii, spacing } from '../theme/colors';

/** Tela de entrada do participante, com validação local e mensagens seguras. */
export default function LoginScreen() {
  const { signIn, notice, clearNotice } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function changeEmail(value: string): void {
    setEmail(value);
    setErrors((previous) => {
      if (previous.email === undefined) {
        return previous;
      }
      const next = { ...previous };
      delete next.email;
      return next;
    });
    setError(null);
    if (notice !== null) {
      clearNotice();
    }
  }

  function changePassword(value: string): void {
    setPassword(value);
    setErrors((previous) => {
      if (previous.password === undefined) {
        return previous;
      }
      const next = { ...previous };
      delete next.password;
      return next;
    });
    setError(null);
    if (notice !== null) {
      clearNotice();
    }
  }

  async function submit(): Promise<void> {
    if (submitting) {
      return;
    }

    if (notice !== null) {
      clearNotice();
    }

    const nextErrors = validateLoginForm({ email, password });
    setErrors(nextErrors);
    setError(null);

    if (hasLoginFormErrors(nextErrors)) {
      return;
    }

    setSubmitting(true);
    try {
      await signIn({
        email: email.trim(),
        password,
      });
      // A navegação protegida redireciona assim que a sessão é aceita.
    } catch (signInError) {
      setError(getAuthErrorMessage(signInError, 'login'));
    } finally {
      setSubmitting(false);
    }
  }

  const bannerMessage = error ?? notice?.message ?? null;

  return (
    <ScreenContainer centerContent>
      <View style={styles.card}>
        <BrandHeader align="center" showTagline />

        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            Login
          </Text>
          <Text style={styles.subtitle}>
            Entre com suas credenciais institucionais para acessar o sistema.
          </Text>
        </View>

        <TextField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          error={errors.email}
          keyboardType="email-address"
          label="E-mail institucional"
          onChangeText={changeEmail}
          placeholder="seu.email@instituicao.edu.br"
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />

        <TextField
          autoCapitalize="none"
          autoComplete="current-password"
          autoCorrect={false}
          error={errors.password}
          label="Senha"
          onChangeText={changePassword}
          onSubmitEditing={() => {
            void submit();
          }}
          placeholder="Digite sua senha"
          returnKeyType="go"
          secureTextEntry
          textContentType="password"
          value={password}
        />

        {bannerMessage ? (
          <MessageBanner
            message={bannerMessage}
            tone={error !== null ? 'error' : (notice?.tone ?? 'error')}
          />
        ) : null}

        <ActionButton
          label="Entrar"
          loading={submitting}
          onPress={() => {
            void submit();
          }}
        />
      </View>

      <Text style={styles.help}>
        Precisa de ajuda? Fale com a equipe responsável pelo estudo.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: 480,
    padding: spacing.lg,
    width: '100%',
  },
  heading: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  help: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
