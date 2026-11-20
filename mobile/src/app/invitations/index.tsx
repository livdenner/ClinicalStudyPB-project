import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSession } from '../../auth/AuthProvider';
import { ActionButton } from '../../components/ActionButton';
import { BackLink } from '../../components/BackLink';
import { BrandHeader } from '../../components/BrandHeader';
import { MessageBanner } from '../../components/MessageBanner';
import { ScreenContainer } from '../../components/ScreenContainer';
import { InvitationStatusBadge } from '../../components/invitations/InvitationStatusBadge';
import { listInvitations } from '../../services/invitations/invitationApi';
import {
  getInvitationLoadErrorMessage,
  INVITATION_MESSAGES,
  isHandledSessionError,
} from '../../services/invitations/invitationErrors';
import {
  formatDateTime,
  invitationStatusLabel,
  normalizeInvitationStatus,
} from '../../services/invitations/invitationPresentation';
import type { StudyInvitationSummary } from '../../services/invitations/invitationTypes';
import { colors, radii, spacing } from '../../theme/colors';

function openInvitation(candidateId: number): void {
  router.push({
    pathname: '/invitations/[candidateId]',
    params: { candidateId: String(candidateId) },
  });
}

function InvitationCard({
  invitation,
}: {
  invitation: StudyInvitationSummary;
}) {
  const decidedAt = formatDateTime(invitation.decidedAt);

  return (
    <Pressable
      accessibilityHint="Abre os detalhes do convite"
      accessibilityLabel={`${invitation.studyTitle}. ${invitationStatusLabel(
        invitation.status,
      )}`}
      accessibilityRole="button"
      onPress={() => openInvitation(invitation.candidateId)}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.cardPressed : null,
      ]}
    >
      <Text style={styles.cardTitle}>{invitation.studyTitle}</Text>
      <InvitationStatusBadge status={invitation.status} />
      {decidedAt ? (
        <Text style={styles.cardMeta}>Decisão registrada em {decidedAt}</Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Lista os convites visíveis da conta. A consulta passa pelo mecanismo
 * autenticado, que trata expiração e senha pendente antes de chegar à tela.
 */
export default function InvitationsScreen() {
  const { runAuthenticated } = useSession();
  const [invitations, setInvitations] = useState<
    StudyInvitationSummary[] | null
  >(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError('');

    async function load(): Promise<void> {
      try {
        const result = await runAuthenticated((accessToken) =>
          listInvitations(accessToken, { signal: controller.signal }),
        );
        if (!active) {
          return;
        }
        setInvitations(Array.isArray(result) ? result : []);
      } catch (caught) {
        if (!active || controller.signal.aborted) {
          return;
        }
        if (isHandledSessionError(caught)) {
          return;
        }
        setError(getInvitationLoadErrorMessage(caught, 'list'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey, runAuthenticated]);

  const list = invitations ?? [];
  const pending = list.filter(
    (invitation) =>
      normalizeInvitationStatus(invitation.status) === 'CONSENT_PENDING',
  );
  const decided = list.filter((invitation) => {
    const status = normalizeInvitationStatus(invitation.status);
    return status === 'GRANTED' || status === 'DECLINED';
  });
  const unknown = list.filter(
    (invitation) =>
      normalizeInvitationStatus(invitation.status) === 'UNKNOWN',
  );

  const errorMessage =
    invitations !== null
      ? `${error} ${INVITATION_MESSAGES.previousData}`
      : error;

  return (
    <ScreenContainer>
      <BrandHeader />
      <BackLink
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}
      />

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Convites
        </Text>
        <Text style={styles.subtitle}>
          Estudos que convidaram você para participar. Leia o resumo e o termo
          simulado antes de decidir.
        </Text>
      </View>

      {error ? <MessageBanner message={errorMessage} tone="error" /> : null}

      {loading ? (
        <View
          accessibilityLabel="Carregando convites"
          accessibilityRole="progressbar"
          style={styles.loading}
        >
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Carregando convites…</Text>
        </View>
      ) : null}

      {!loading && invitations !== null && list.length === 0 ? (
        <MessageBanner
          message="Você não tem convites disponíveis no momento. Quando a equipe responsável enviar um convite, ele aparecerá aqui."
          tone="info"
        />
      ) : null}

      {!loading && list.length > 0 ? (
        <>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Pendentes
            </Text>
            {pending.length === 0 ? (
              <Text style={styles.sectionEmpty}>
                Nenhum convite aguardando decisão.
              </Text>
            ) : (
              pending.map((invitation) => (
                <InvitationCard
                  invitation={invitation}
                  key={invitation.candidateId}
                />
              ))
            )}
          </View>

          {decided.length > 0 ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Decisões registradas
              </Text>
              {decided.map((invitation) => (
                <InvitationCard
                  invitation={invitation}
                  key={invitation.candidateId}
                />
              ))}
            </View>
          ) : null}

          {unknown.length > 0 ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Outros convites
              </Text>
              {unknown.map((invitation) => (
                <InvitationCard
                  invitation={invitation}
                  key={invitation.candidateId}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {!loading && error ? (
        <ActionButton
          label="Tentar novamente"
          onPress={() => setReloadKey((key) => key + 1)}
          variant="secondary"
        />
      ) : null}
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
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  section: {
    gap: spacing.sm + 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionEmpty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
