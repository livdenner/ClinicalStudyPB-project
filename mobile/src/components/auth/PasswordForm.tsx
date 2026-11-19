import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  hasPasswordFormErrors,
  PASSWORD_MESSAGES,
  validatePasswordForm,
  type PasswordFormErrors,
  type PasswordFormValues,
  type PasswordMode,
} from '../../auth/passwordPolicy';
import { getAuthErrorMessage } from '../../services/auth/authErrors';
import { colors, radii, spacing } from '../../theme/colors';
import { ActionButton } from '../ActionButton';
import { MessageBanner } from '../MessageBanner';
import { TextField } from '../TextField';

interface PasswordFormProps {
  mode: PasswordMode;
  submitLabel: string;
  onSubmit: (values: PasswordFormValues) => Promise<void>;
}

const EMPTY_VALUES: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/**
 * Formulário compartilhado entre o primeiro acesso e a troca de senha.
 * A validação local evita idas à API; erros do servidor são traduzidos para
 * uma mensagem genérica e segura.
 */
export function PasswordForm({
  mode,
  submitLabel,
  onSubmit,
}: PasswordFormProps) {
  const [values, setValues] = useState<PasswordFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<PasswordFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateValue(field: keyof PasswordFormValues, value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (previous[field] === undefined) {
        return previous;
      }
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  async function submit(): Promise<void> {
    if (submitting) {
      return;
    }

    const nextErrors = validatePasswordForm(mode, values);
    setErrors(nextErrors);
    setFormError(null);

    if (hasPasswordFormErrors(nextErrors)) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      setFormError(getAuthErrorMessage(error, 'password'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      {formError ? <MessageBanner message={formError} tone="error" /> : null}

      {mode === 'change' ? (
        <TextField
          autoCapitalize="none"
          autoComplete="current-password"
          autoCorrect={false}
          error={errors.currentPassword}
          label="Senha atual"
          onChangeText={(value) => updateValue('currentPassword', value)}
          returnKeyType="next"
          secureTextEntry
          textContentType="password"
          value={values.currentPassword}
        />
      ) : null}

      <TextField
        autoCapitalize="none"
        autoComplete="new-password"
        autoCorrect={false}
        error={errors.newPassword}
        hint={PASSWORD_MESSAGES.policy}
        label="Nova senha"
        onChangeText={(value) => updateValue('newPassword', value)}
        returnKeyType="next"
        secureTextEntry
        textContentType="newPassword"
        value={values.newPassword}
      />

      <TextField
        autoCapitalize="none"
        autoComplete="new-password"
        autoCorrect={false}
        error={errors.confirmPassword}
        label="Confirmar nova senha"
        onChangeText={(value) => updateValue('confirmPassword', value)}
        returnKeyType="done"
        secureTextEntry
        textContentType="newPassword"
        value={values.confirmPassword}
      />

      <ActionButton
        label={submitLabel}
        loading={submitting}
        onPress={() => {
          void submit();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
});
