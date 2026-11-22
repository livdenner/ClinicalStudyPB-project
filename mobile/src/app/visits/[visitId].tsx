import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
  findParticipantVisitById,
  normalizeVisitStatus,
  parseVisitId,
} from '../../services/visits/visitPresentation';
import type { ParticipantVisit } from '../../services/visits/visitTypes';
import { colors, radii, spacing } from '../../theme/colors';

/**
 * Detalhe de uma visita agendada ou finalizada do participante autenticado.
 * Resolve os dados a partir de `/me/visits` da própria conta e reserva o espaço
 * das ações de presença/reagendamento (RF19) para entrega futura.
 */
export default function VisitDetailScreen() {
  const params = useLocalSearchParams<{
    visitId?: string | string[];
  }>();
  const visitId = parseVisitId(params.visitId);
  const { runAuthenticated, session } = useSession();
  const currentUserId = session?.user.id ?? null;

  const [visit, setVisit] = useState<ParticipantVisit | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(visitId !== null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setVisit(null);
    setNotFound(false);
    setError('');
  }, [currentUserId, visitId]);

  useFocusEffect(
    useCallback(() => {
      if (visitId === null || currentUserId === null) {
        setLoading(false);
        return undefined;
      }

      const controller = new AbortController();
      let active = true;

      setLoading(true);
      setError('');
      setNotFound(false);

      async function load(targetVisitId: number): Promise<void> {
        try {
          const result = await runAuthenticated((accessToken) =>
            getMyVisits(accessToken, controller.signal),
          );
          if (!active || controller.signal.aborted) {
            return;
          }

          const matched = findParticipantVisitById(result, targetVisitId);
          if (matched === null) {
            setVisit(null);
            setNotFound(true);
            return;
          }

          setVisit(matched);
          setNotFound(false);
        } catch (caught) {
          if (
            !active ||
            controller.signal.aborted ||
            isHandledSessionError(caught)
          ) {
            return;
          }
          setError(getVisitLoadErrorMessage(caught, 'detail'));
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void load(visitId);

      return () => {
        active = false;
        controller.abort();
      };
    }, [currentUserId, reloadKey, runAuthenticated, visitId]),
  );

  const initialLoading = loading && visit === null;
  const normalizedStatus = visit ? normalizeVisitStatus(visit.status) : null;
  const visitTitle = visit
    ? visit.plannedVisitName.trim() || 'Visita agendada'
    : '';
  const scheduledLabel = visit ? formatDateTime(visit.scheduledAt) : null;
  const outcomeLabel =
    visit && normalizedStatus !== 'SCHEDULED' && visit.outcomeAt
      ? formatDateTime(visit.outcomeAt)
      : null;
  const cancellationReason =
    visit && normalizedStatus === 'CANCELLED'
      ? visit.cancellationReason?.trim() || null
      : null;
  const finalizedOutcome =
    normalizedStatus === 'DONE' ||
    normalizedStatus === 'ABSENT' ||
    normalizedStatus === 'CANCELLED';
  const errorMessage =
    visit !== null ? `${error} ${VISIT_MESSAGES.previousDetailData}` : error;

  return (
    <ScreenContainer>
      <BrandHeader />
      <BackLink
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/visits');
          }
        }}
      />

      {visitId === null ? (
        <>
          <MessageBanner message={VISIT_MESSAGES.invalidId} tone="error" />
          <ActionButton
            label="Voltar às visitas"
            onPress={() => router.replace('/visits')}
            variant="secondary"
          />
        </>
      ) : null}

      {visitId !== null && initialLoading ? (
        <View
          accessibilityLabel="Carregando visita"
          accessibilityRole="progressbar"
          style={styles.loading}
        >
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Carregando visita…</Text>
        </View>
      ) : null}

      {visitId !== null && !initialLoading && loading && visit !== null ? (
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
          Atualizando visita…
        </Text>
      ) : null}

      {visitId !== null && error ? (
        <MessageBanner message={errorMessage} tone="error" />
      ) : null}

      {visitId !== null && !loading && error ? (
        <ActionButton
          label="Tentar novamente"
          onPress={() => setReloadKey((key) => key + 1)}
          variant="secondary"
        />
      ) : null}

      {visitId !== null && !loading && !error && notFound ? (
        <>
          <MessageBanner message={VISIT_MESSAGES.notAvailable} tone="error" />
          <ActionButton
            label="Voltar às visitas"
            onPress={() => router.replace('/visits')}
            variant="secondary"
          />
        </>
      ) : null}

      {visitId !== null && visit !== null ? (
        <>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              Detalhes da visita
            </Text>
            <Text style={styles.subtitle}>Estudo: {visit.studyTitle}</Text>
          </View>

          <View style={styles.card}>
            <VisitStatusBadge status={visit.status} />
            <Text style={styles.visitTitle}>{visitTitle}</Text>
            <View style={styles.metaList}>
              <Text style={styles.meta}>
                <Text style={styles.metaLabel}>Estudo: </Text>
                {visit.studyTitle}
              </Text>
              <Text style={styles.meta}>
                <Text style={styles.metaLabel}>Data e hora: </Text>
                {scheduledLabel ?? 'Horário não informado'}
              </Text>
              {normalizedStatus !== 'SCHEDULED' && outcomeLabel ? (
                <Text style={styles.meta}>
                  <Text style={styles.metaLabel}>Desfecho registrado em: </Text>
                  {outcomeLabel}
                </Text>
              ) : null}
              {cancellationReason ? (
                <Text style={styles.cancellationReason}>
                  <Text style={styles.cancellationLabel}>
                    Motivo do cancelamento:{' '}
                  </Text>
                  {cancellationReason}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Atividades previstas
            </Text>
            {visit.activities.length === 0 ? (
              <Text style={styles.muted}>{VISIT_MESSAGES.emptyActivities}</Text>
            ) : (
              <View style={styles.activityList}>
                {visit.activities.map((activity) => {
                  const description = activity.description.trim();
                  return (
                    <Text key={activity.id} style={styles.activityItem}>
                      {`• ${activity.name}${
                        description ? ` — ${description}` : ''
                      }`}
                    </Text>
                  );
                })}
              </View>
            )}
          </View>

          {normalizedStatus === 'SCHEDULED' ? (
            <View style={styles.rf19Card}>
              <Text style={styles.rf19Title}>
                {VISIT_MESSAGES.rf19ReservedTitle}
              </Text>
              <Text style={styles.rf19Body}>
                {VISIT_MESSAGES.rf19ReservedBody}
              </Text>
            </View>
          ) : null}

          {finalizedOutcome ? (
            <MessageBanner
              message={VISIT_MESSAGES.finalizedOutcomeNotice}
              tone="info"
            />
          ) : null}
        </>
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  visitTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  metaList: {
    gap: spacing.xs + 2,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  metaLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  cancellationReason: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  cancellationLabel: {
    color: colors.error,
    fontWeight: '600',
  },
  activityList: {
    gap: spacing.xs + 2,
  },
  activityItem: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  rf19Card: {
    backgroundColor: colors.surface,
    borderColor: colors.neutralBorder,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  rf19Title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rf19Body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
