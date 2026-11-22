import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { VisitStatusBadge } from '../../components/visits/VisitStatusBadge';
import { isHandledSessionError } from '../../services/auth/authErrors';
import { formatDateTime } from '../../services/format/dateFormat';
import { getMyVisits } from '../../services/visits/visitApi';
import {
  getVisitLoadErrorMessage,
  VISIT_MESSAGES,
} from '../../services/visits/visitErrors';
import {
  normalizeVisitStatus,
  visitStatusLabel,
} from '../../services/visits/visitPresentation';
import type {
  ParticipantVisit,
  ParticipantVisits,
} from '../../services/visits/visitTypes';
import { colors, radii, spacing } from '../../theme/colors';

type VisitTab = 'upcoming' | 'history';

function openVisit(visitId: number): void {
  router.push({
    pathname: '/visits/[visitId]',
    params: { visitId: String(visitId) },
  });
}

function EmptyVisitsSection({ tab }: { tab: VisitTab }) {
  const title =
    tab === 'upcoming'
      ? VISIT_MESSAGES.emptyUpcomingTitle
      : VISIT_MESSAGES.emptyHistoryTitle;
  const description =
    tab === 'upcoming'
      ? VISIT_MESSAGES.emptyUpcoming
      : VISIT_MESSAGES.emptyHistory;

  return (
    <View style={styles.emptyCard}>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

function VisitCard({
  visit,
  section,
}: {
  visit: ParticipantVisit;
  section: VisitTab;
}) {
  const visitTitle = visit.plannedVisitName.trim() || 'Visita agendada';
  const scheduledLabel = formatDateTime(visit.scheduledAt);
  const outcomeLabel =
    section === 'history' && visit.outcomeAt
      ? formatDateTime(visit.outcomeAt)
      : null;
  const cancellationReason =
    section === 'history' && normalizeVisitStatus(visit.status) === 'CANCELLED'
      ? visit.cancellationReason?.trim() || null
      : null;

  return (
    <Pressable
      accessibilityHint="Abre os detalhes da visita"
      accessibilityLabel={`${visitTitle}. ${visitStatusLabel(
        visit.status,
      )}. ${visit.studyTitle}`}
      accessibilityRole="button"
      onPress={() => openVisit(visit.id)}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.cardPressed : null,
      ]}
    >
      <VisitStatusBadge status={visit.status} />
      <Text style={styles.cardTitle}>{visitTitle}</Text>
      <Text style={styles.cardMeta}>
        {scheduledLabel ?? 'Horário não informado'}
      </Text>
      <Text style={styles.cardMeta}>Estudo: {visit.studyTitle}</Text>
      {outcomeLabel ? (
        <Text style={styles.cardMeta}>Desfecho em {outcomeLabel}</Text>
      ) : null}
      {cancellationReason ? (
        <Text style={styles.cancellationReason}>
          Motivo: {cancellationReason}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Lista as próximas visitas (`SCHEDULED`) e o histórico de comparecimento
 * (`DONE`, `ABSENT`, `CANCELLED`) do participante autenticado.
 */
export default function VisitsScreen() {
  const { runAuthenticated, session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const [activeTab, setActiveTab] = useState<VisitTab>('upcoming');
  const [visits, setVisits] = useState<ParticipantVisits | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setVisits(null);
    setError('');
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      if (currentUserId === null) {
        return;
      }

      const controller = new AbortController();
      let active = true;

      setLoading(true);
      setError('');

      async function load(): Promise<void> {
        try {
          const result = await runAuthenticated((accessToken) =>
            getMyVisits(accessToken, controller.signal),
          );
          if (!active) {
            return;
          }
          setVisits(result);
        } catch (caught) {
          if (
            !active ||
            controller.signal.aborted ||
            isHandledSessionError(caught)
          ) {
            return;
          }
          setError(getVisitLoadErrorMessage(caught, 'list'));
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
    }, [currentUserId, reloadKey, runAuthenticated]),
  );

  const initialLoading = loading && visits === null;
  const visibleVisits =
    visits === null
      ? []
      : activeTab === 'upcoming'
        ? visits.upcoming
        : visits.history;
  const hasCachedVisits =
    visits !== null &&
    (visits.upcoming.length > 0 || visits.history.length > 0);
  const errorMessage = hasCachedVisits
    ? `${error} ${VISIT_MESSAGES.previousData}`
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
          Visitas
        </Text>
        <Text style={styles.subtitle}>
          Acompanhe suas próximas visitas agendadas e o histórico de
          comparecimento.
        </Text>
      </View>

      {error ? <MessageBanner message={errorMessage} tone="error" /> : null}

      {initialLoading ? (
        <View
          accessibilityLabel="Carregando visitas"
          accessibilityRole="progressbar"
          style={styles.loading}
        >
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Carregando visitas…</Text>
        </View>
      ) : null}

      {loading && visits !== null ? (
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
          Atualizando visitas…
        </Text>
      ) : null}

      {!initialLoading && visits !== null ? (
        <View style={styles.content}>
          <View accessibilityRole="tablist" style={styles.tabBar}>
            <Pressable
              accessibilityLabel="Próximas"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'upcoming' }}
              onPress={() => setActiveTab('upcoming')}
              style={[
                styles.tabButton,
                activeTab === 'upcoming' ? styles.tabButtonActive : null,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'upcoming' ? styles.tabTextActive : null,
                ]}
              >
                Próximas
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Histórico"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'history' }}
              onPress={() => setActiveTab('history')}
              style={[
                styles.tabButton,
                activeTab === 'history' ? styles.tabButtonActive : null,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'history' ? styles.tabTextActive : null,
                ]}
              >
                Histórico
              </Text>
            </Pressable>
          </View>

          {visibleVisits.length === 0 ? (
            error ? null : <EmptyVisitsSection tab={activeTab} />
          ) : (
            <View style={styles.list}>
              {visibleVisits.map((visit) => (
                <VisitCard key={visit.id} section={activeTab} visit={visit} />
              ))}
            </View>
          )}
        </View>
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
  content: {
    gap: spacing.md,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: colors.brand,
  },
  tabText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.surface,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
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
    fontSize: 13,
    lineHeight: 18,
  },
  cancellationReason: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
  },
});
