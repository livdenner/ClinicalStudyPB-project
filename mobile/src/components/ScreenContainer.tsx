import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme/colors';

interface ScreenContainerProps {
  /** Centraliza o conteúdo quando ele é menor que a tela, como no login. */
  centerContent?: boolean;
}

/**
 * Contêiner comum das telas: área segura, rolagem e ajuste ao teclado.
 * Mantém os botões alcançáveis em telas pequenas e com o teclado aberto.
 */
export function ScreenContainer({
  children,
  centerContent = false,
}: PropsWithChildren<ScreenContainerProps>) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.inner, centerContent ? styles.centered : null]}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  inner: {
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
});
