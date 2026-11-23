import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '../auth/AuthProvider';
import { ActionButton } from '../components/ActionButton';
import { BrandHeader } from '../components/BrandHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MessageBanner } from '../components/MessageBanner';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing } from '../theme/colors';

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Início autenticado do participante, com acesso a estudos e à própria conta. */
export default function HomeScreen() {
  const { session, signOut, persistenceWarning } = useSession();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (session === null) {
    return null;
  }

  const greeting = firstName(session.user.name);
  const initial = greeting.charAt(0).toUpperCase();

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

      <View style={styles.greeting}>
        <Text accessibilityRole="header" style={styles.title}>
          Olá, {greeting}!
        </Text>
        <Text style={styles.subtitle}>
          Acompanhe sua participação e suas visitas.
        </Text>
      </View>

      {persistenceWarning ? (
        <MessageBanner message={persistenceWarning} tone="warning" />
      ) : null}

      <View style={styles.card}>
        <View style={styles.accountRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{session.user.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Participante</Text>
            </View>
            <Text style={styles.email}>{session.user.email}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <Text style={styles.cardHint}>
          Seus dados de acesso são gerenciados pela equipe responsável pelo
          estudo.
        </Text>
      </View>

      <View style={styles.actions}>
        <ActionButton
          label="Ver convites"
          onPress={() => router.push('/invitations')}
        />
        <ActionButton
          label="Ver estudos"
          onPress={() => router.push('/studies')}
          variant="secondary"
        />
        <ActionButton
          label="Ver visitas"
          onPress={() => router.push('/visits')}
          variant="secondary"
        />
        <ActionButton
          label="Trocar senha"
          onPress={() => router.push('/change-password')}
          variant="secondary"
        />
        <ActionButton
          label="Sair"
          onPress={() => setConfirmingSignOut(true)}
          variant="secondary"
        />
      </View>

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
  greeting: {
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  accountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.neutralSoft,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  avatarText: {
    color: colors.brandDark,
    fontSize: 22,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  accountName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.neutralSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '600',
  },
  email: {
    color: colors.textMuted,
    fontSize: 13,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
  },
  cardHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: spacing.sm + 4,
  },
});
