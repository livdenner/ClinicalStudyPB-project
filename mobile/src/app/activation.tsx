import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '../auth/AuthProvider';
import {
  hasActivationFormErrors,
  validateActivationForm,
  type ActivationFormErrors,
} from '../auth/activationForm';
import { ActionButton } from '../components/ActionButton';
import { BrandHeader } from '../components/BrandHeader';
import { MessageBanner } from '../components/MessageBanner';
import { ScreenContainer } from '../components/ScreenContainer';
import { TextField } from '../components/TextField';
import { getAuthErrorMessage } from '../services/auth/authErrors';
import { colors, radii, spacing } from '../theme/colors';

/**
 * Primeiro acesso do candidato convidado. A ativação devolve uma sessão
 * restrita, e os guards levam diretamente à definição da senha inicial.
 */
export default function ActivationScreen() {
  const { activateAccount } = useSession();
  const [email, setEmail] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [errors, setErrors] = useState<ActivationFormErrors>({});
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
  }

  function changeCode(value: string): void {
    setActivationCode(value);
    setErrors((previous) => {
      if (previous.activationCode === undefined) {
        return previous;
      }
      const next = { ...previous };
      delete next.activationCode;
      return next;
    });
    setError(null);
  }

  async function submit(): Promise<void> {
    if (submitting) {
      return;
    }

    const nextErrors = validateActivationForm({ email, activationCode });
    setErrors(nextErrors);
    setError(null);

    if (hasActivationFormErrors(nextErrors)) {
      return;
    }

    setSubmitting(true);
    try {
      await activateAccount({
        email: email.trim(),
        activationCode: activationCode.trim(),
      });
      // A sessão restrita é encaminhada à troca de senha pelos guards.
    } catch (activationError) {
      setError(getAuthErrorMessage(activationError, 'activation'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer centerContent>
      <View style={styles.card}>
        <BrandHeader align="center" showTagline />

        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            Primeiro acesso
          </Text>
          <Text style={styles.subtitle}>
            Informe o e-mail cadastrado pelo coordenador e o código de ativação
            recebido.
          </Text>
        </View>

        <MessageBanner
          message="O código é de uso único e vale por 72 horas. Depois de ativar, você definirá sua senha pessoal."
          tone="info"
        />

        <TextField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          error={errors.email}
          keyboardType="email-address"
          label="E-mail cadastrado"
          onChangeText={changeEmail}
          placeholder="seu.email@exemplo.com"
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />

        <TextField
          autoCapitalize="none"
          autoComplete="one-time-code"
          autoCorrect={false}
          error={errors.activationCode}
          hint="Copie o código exatamente como recebeu; ele diferencia maiúsculas de minúsculas."
          label="Código de ativação"
          maxLength={32}
          onChangeText={changeCode}
          onSubmitEditing={() => {
            void submit();
          }}
          placeholder="Digite o código recebido"
          returnKeyType="go"
          textContentType="oneTimeCode"
          value={activationCode}
        />

        {error ? <MessageBanner message={error} tone="error" /> : null}

        <ActionButton
          label="Ativar minha conta"
          loading={submitting}
          onPress={() => {
            void submit();
          }}
        />

        <ActionButton
          label="Voltar ao login"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/login');
            }
          }}
          variant="secondary"
        />
      </View>

      <Text style={styles.help}>
        Se o prazo tiver expirado, solicite um novo código ao coordenador do
        estudo.
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
