import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useSession } from '../auth/AuthProvider';
import { sessionStorage } from '../auth/sessionStorage';
import { colors, spacing } from '../theme/colors';

function LoadingOverlay() {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.loading}
    >
      <ActivityIndicator color={colors.brand} size="large" />
      <Text style={styles.loadingText}>Carregando sua sessão…</Text>
    </View>
  );
}

function RootNavigator() {
  const { status, session } = useSession();
  const authenticated = status === 'authenticated' && session !== null;
  const restricted = session?.user.mustChangePassword === true;

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Protected guard={!authenticated}>
          <Stack.Screen name="login" />
          <Stack.Screen name="activation" />
        </Stack.Protected>

        <Stack.Protected guard={authenticated && !restricted}>
          <Stack.Screen name="index" />
          <Stack.Screen name="studies" />
          <Stack.Screen name="invitations/index" />
          <Stack.Screen name="invitations/[candidateId]" />
        </Stack.Protected>

        <Stack.Protected guard={authenticated}>
          <Stack.Screen name="change-password" />
        </Stack.Protected>
      </Stack>

      {status === 'loading' ? <LoadingOverlay /> : null}
    </View>
  );
}

/**
 * A sessão é restaurada antes de as rotas privadas serem liberadas. Enquanto
 * isso, apenas o login existe e uma camada de carregamento cobre a tela.
 */
export default function RootLayout() {
  return (
    <AuthProvider storage={sessionStorage}>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    bottom: 0,
    gap: spacing.md,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
