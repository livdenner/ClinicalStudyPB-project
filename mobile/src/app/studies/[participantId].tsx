import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../../auth/AuthProvider';
import { ActionButton } from '../../components/ActionButton';
import { BackLink } from '../../components/BackLink';
import { BrandHeader } from '../../components/BrandHeader';
import { MessageBanner } from '../../components/MessageBanner';
import { ScreenContainer } from '../../components/ScreenContainer';
import { PlannedVisitCard } from '../../components/protocol/PlannedVisitCard';
import { ParticipationStatusBadge } from '../../components/studies/ParticipationStatusBadge';
import { StudyStatusBadge } from '../../components/studies/StudyStatusBadge';
import { isHandledSessionError } from '../../services/auth/authErrors';
import { formatDateTime } from '../../services/format/dateFormat';
import { listMyStudies } from '../../services/studies/studyApi';
import {
  getStudyLoadErrorMessage,
  STUDY_MESSAGES,
} from '../../services/studies/studyErrors';
import {
  formatStudyPeriod,
  normalizeParticipationStatus,
  parseParticipantId,
} from '../../services/studies/studyPresentation';
import type { ParticipantStudy } from '../../services/studies/studyTypes';
import { colors, radii, spacing } from '../../theme/colors';

/**
 * Detalhe de uma participação do usuário autenticado com objetivo e protocolo
 * de visitas previstas. Resolve os dados exclusivamente pela lista autorizada
 * de `/me/studies` da própria conta.
 */
export default function StudyDetailScreen() {
  const params = useLocalSearchParams<{
    participantId?: string | string[];
  }>();
  const participantId = parseParticipantId(params.participantId);
  const { runAuthenticated, session } = useSession();
  const currentUserId = session?.user.id ?? null;

  const [study, setStudy] = useState<ParticipantStudy | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(participantId !== null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setStudy(null);
    setNotFound(false);
    setError('');
  }, [currentUserId, participantId]);

  useFocusEffect(
    useCallback(() => {
      if (participantId === null || currentUserId === null) {
        setLoading(false);
        return undefined;
      }

      const controller = new AbortController();
      let active = true;

      setLoading(true);
      setError('');
      setNotFound(false);

      async function load(targetParticipantId: number): Promise<void> {
        try {
          const result = await runAuthenticated((accessToken) =>
            listMyStudies(accessToken, controller.signal),
          );
          if (!active || controller.signal.aborted) {
            return;
          }

          const matched =
            result.find(
              (item) => item.participantId === targetParticipantId,
            ) ?? null;

          if (matched === null) {
            setStudy(null);
            setNotFound(true);
            return;
          }

          setStudy(matched);
          setNotFound(false);
        } catch (caught) {
          if (!active || controller.signal.aborted) {
            return;
          }
          if (isHandledSessionError(caught)) {
            return;
          }
          setError(getStudyLoadErrorMessage(caught, 'detail'));
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void load(participantId);

      return () => {
        active = false;
        controller.abort();
      };
    }, [currentUserId, participantId, reloadKey, runAuthenticated]),
  );

  const initialLoading = loading && study === null;
  const period = study
    ? formatStudyPeriod(study.startDate, study.endDate)
    : null;
  const includedAt = study ? formatDateTime(study.includedAt) : null;
  const withdrawnAt = study ? formatDateTime(study.withdrawnAt) : null;
  const withdrawn =
    study !== null &&
    normalizeParticipationStatus(study.participationStatus) === 'WITHDRAWN';
  const errorMessage =
    study !== null ? `${error} ${STUDY_MESSAGES.previousDetailData}` : error;

  return (
    <ScreenContainer>
      <BrandHeader />
      <BackLink
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/studies');
          }
        }}
      />

      {participantId === null ? (
        <>
          <MessageBanner message={STUDY_MESSAGES.invalidId} tone="error" />
          <ActionButton
            label="Voltar aos estudos"
            onPress={() => router.replace('/studies')}
            variant="secondary"
          />
        </>
      ) : null}

      {participantId !== null && initialLoading ? (
        <View
          accessibilityLabel="Carregando estudo"
          accessibilityRole="progressbar"
          style={styles.loading}
        >
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Carregando estudo…</Text>
        </View>
      ) : null}

      {participantId !== null && !initialLoading && loading && study !== null ? (
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
          Atualizando estudo…
        </Text>
      ) : null}

      {participantId !== null && error ? (
        <MessageBanner message={errorMessage} tone="error" />
      ) : null}

      {participantId !== null && !loading && error ? (
        <ActionButton
          label="Tentar novamente"
          onPress={() => setReloadKey((key) => key + 1)}
          variant="secondary"
        />
      ) : null}

      {participantId !== null && !loading && !error && notFound ? (
        <>
          <MessageBanner message={STUDY_MESSAGES.notAvailable} tone="error" />
          <ActionButton
            label="Voltar aos estudos"
            onPress={() => router.replace('/studies')}
            variant="secondary"
          />
        </>
      ) : null}

      {participantId !== null && study !== null ? (
        <>
          <View style={styles.heading}>
            <View style={styles.badges}>
              <StudyStatusBadge status={study.studyStatus} />
              <ParticipationStatusBadge status={study.participationStatus} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {study.studyTitle}
            </Text>
            <Text style={styles.subtitle}>
              {period
                ? `${study.responsibleName} · ${period}`
                : study.responsibleName}
            </Text>
          </View>

          {withdrawn ? (
            <MessageBanner
              message={STUDY_MESSAGES.withdrawnNotice}
              tone="neutral"
            />
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sobre o estudo</Text>
            <Text style={styles.cardText}>{study.studyObjective}</Text>
            <View style={styles.metaList}>
              <Text style={styles.meta}>
                <Text style={styles.metaLabel}>Pesquisador responsável: </Text>
                {study.responsibleName}
              </Text>
              {period ? (
                <Text style={styles.meta}>
                  <Text style={styles.metaLabel}>Período: </Text>
                  {period}
                </Text>
              ) : null}
              <Text style={styles.meta}>
                <Text style={styles.metaLabel}>Inclusão: </Text>
                {includedAt ?? 'Data indisponível'}
              </Text>
              {withdrawnAt ? (
                <Text style={styles.meta}>
                  <Text style={styles.metaLabel}>Retirada: </Text>
                  {withdrawnAt}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Visitas previstas
            </Text>
            <Text style={styles.muted}>
              Datas previstas do protocolo do estudo (não representam
              agendamento confirmado).
            </Text>
            {study.plannedVisits.length === 0 ? (
              <MessageBanner message={STUDY_MESSAGES.emptyVisits} tone="info" />
            ) : (
              study.plannedVisits.map((visit) => (
                <PlannedVisitCard
                  datePrefix="Data prevista"
                  key={visit.id}
                  visit={visit}
                />
              ))
            )}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
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
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  metaList: {
    gap: spacing.xs + 2,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  metaLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  section: {
    gap: spacing.sm + 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
