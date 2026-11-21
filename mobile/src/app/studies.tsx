import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../auth/AuthProvider';
import { ActionButton } from '../components/ActionButton';
import { BackLink } from '../components/BackLink';
import { BrandHeader } from '../components/BrandHeader';
import { MessageBanner } from '../components/MessageBanner';
import { ScreenContainer } from '../components/ScreenContainer';
import { ParticipationStatusBadge } from '../components/studies/ParticipationStatusBadge';
import { StudyStatusBadge } from '../components/studies/StudyStatusBadge';
import { isHandledSessionError } from '../services/auth/authErrors';
import { formatDateTime } from '../services/format/dateFormat';
import { listMyStudies } from '../services/studies/studyApi';
import {
  getStudyLoadErrorMessage,
  STUDY_MESSAGES,
} from '../services/studies/studyErrors';
import type { ParticipantStudy } from '../services/studies/studyTypes';
import { colors, radii, spacing } from '../theme/colors';

function StudyCard({ study }: { study: ParticipantStudy }) {
  const includedAt = formatDateTime(study.includedAt);
  const withdrawnAt = formatDateTime(study.withdrawnAt);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{study.studyTitle}</Text>
      <View style={styles.badges}>
        <StudyStatusBadge status={study.studyStatus} />
        <ParticipationStatusBadge status={study.participationStatus} />
      </View>
      <Text style={styles.cardMeta}>
        {includedAt
          ? `Incluído em ${includedAt}`
          : 'Data de inclusão indisponível'}
      </Text>
      {withdrawnAt ? (
        <Text style={styles.cardMeta}>{`Retirado em ${withdrawnAt}`}</Text>
      ) : null}
    </View>
  );
}

/**
 * Lista os estudos em que a conta participante autenticada foi incluída.
 * Mantém o estado do estudo separado da situação da participação.
 */
export default function StudiesScreen() {
  const { runAuthenticated, session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const [studies, setStudies] = useState<ParticipantStudy[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setStudies(null);
    setError('');
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      if (currentUserId === null) {
        setLoading(false);
        return undefined;
      }

      const controller = new AbortController();
      let active = true;

      setLoading(true);
      setError('');

      async function load(): Promise<void> {
        try {
          const result = await runAuthenticated((accessToken) =>
            listMyStudies(accessToken, controller.signal),
          );
          if (!active || controller.signal.aborted) {
            return;
          }
          setStudies(result);
        } catch (caught) {
          if (!active || controller.signal.aborted) {
            return;
          }
          if (isHandledSessionError(caught)) {
            return;
          }
          setError(getStudyLoadErrorMessage(caught));
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

  const list = studies ?? [];
  const initialLoading = loading && studies === null;
  const errorMessage =
    studies !== null ? `${error} ${STUDY_MESSAGES.previousData}` : error;

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
          Meus estudos
        </Text>
        <Text style={styles.subtitle}>
          Estudos clínicos em que sua conta foi incluída.
        </Text>
      </View>

      {error ? <MessageBanner message={errorMessage} tone="error" /> : null}

      {initialLoading ? (
        <View
          accessibilityLabel="Carregando estudos"
          accessibilityRole="progressbar"
          style={styles.loading}
        >
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Carregando estudos…</Text>
        </View>
      ) : null}

      {!initialLoading && loading && studies !== null ? (
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
          Atualizando estudos…
        </Text>
      ) : null}

      {!initialLoading && !error && studies !== null && list.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageBanner message={STUDY_MESSAGES.empty} tone="info" />
          <ActionButton
            label="Ver convites"
            onPress={() => router.push('/invitations')}
            variant="secondary"
          />
        </View>
      ) : null}

      {!initialLoading && list.length > 0 ? (
        <View style={styles.list}>
          {list.map((study) => (
            <StudyCard key={study.participantId} study={study} />
          ))}
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
  emptyState: {
    gap: spacing.md,
  },
  list: {
    gap: spacing.sm + 4,
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
    fontSize: 16,
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
