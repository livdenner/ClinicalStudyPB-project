import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSession } from '../../auth/AuthProvider';
import { ActionButton } from '../../components/ActionButton';
import { BackLink } from '../../components/BackLink';
import { BrandHeader } from '../../components/BrandHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MessageBanner } from '../../components/MessageBanner';
import { ScreenContainer } from '../../components/ScreenContainer';
import { InvitationStatusBadge } from '../../components/invitations/InvitationStatusBadge';
import {
  decideInvitation,
  getInvitation,
} from '../../services/invitations/invitationApi';
import {
  blocksInvitationDecision,
  getInvitationDecisionErrorMessage,
  getInvitationLoadErrorMessage,
  INVITATION_MESSAGES,
  isHandledSessionError,
  shouldRefreshInvitationAfterDecisionError,
} from '../../services/invitations/invitationErrors';
import {
  formatCivilDate,
  formatDateTime,
  normalizeInvitationStatus,
  parseCandidateId,
} from '../../services/invitations/invitationPresentation';
import type {
  InvitationDecision,
  PlannedVisit,
  StudyInvitation,
} from '../../services/invitations/invitationTypes';
import { colors, radii, spacing } from '../../theme/colors';

const SIMULATION_NOTICE =
  'Consentimento simulado para fins acadêmicos, sem validade legal.';

function ResultBanner({ invitation }: { invitation: StudyInvitation }) {
  const status = normalizeInvitationStatus(invitation.status);
  if (status !== 'GRANTED' && status !== 'DECLINED') {
    return null;
  }

  const decidedAt = formatDateTime(invitation.decidedAt);
  const granted = status === 'GRANTED';
  const message = granted
    ? 'Consentimento aceito. A equipe responsável poderá prosseguir com a avaliação da sua inclusão no estudo.'
    : 'Consentimento recusado. A recusa é uma decisão válida e não poderá ser alterada pelo aplicativo.';

  return (
    <>
      <MessageBanner message={message} tone={granted ? 'success' : 'neutral'} />
      {decidedAt ? (
        <Text style={styles.decidedAt}>Decisão registrada em {decidedAt}.</Text>
      ) : null}
    </>
  );
}

function decisionDialogTitle(decision: InvitationDecision): string {
  return decision === 'DECLINED' ? 'Confirmar recusa?' : 'Confirmar aceite?';
}

function decisionDialogMessage(
  decision: InvitationDecision,
  studyTitle: string,
): string {
  return decision === 'DECLINED'
    ? `Você vai recusar o convite do estudo "${studyTitle}". A recusa é uma decisão válida e não poderá ser alterada pelo aplicativo.`
    : `Você vai aceitar o convite do estudo "${studyTitle}". A decisão é única e não poderá ser alterada pelo aplicativo.`;
}

function VisitCard({ visit }: { visit: PlannedVisit }) {
  const plannedDate = formatCivilDate(visit.plannedDate);
  const activities = Array.isArray(visit.activities) ? visit.activities : [];

  return (
    <View style={styles.visitCard}>
      <View style={styles.visitHeader}>
        <Text style={styles.visitName}>{visit.name}</Text>
        <Text style={styles.visitDate}>
          {plannedDate ?? 'Data não informada'}
        </Text>
      </View>
      {activities.length === 0 ? (
        <Text style={styles.muted}>Sem atividades previstas.</Text>
      ) : (
        activities.map((activity) => (
          <Text key={activity.id} style={styles.activity}>
            • {activity.name}
            {activity.description ? ` — ${activity.description}` : ''}
          </Text>
        ))
      )}
    </View>
  );
}

/**
 * Detalhe de um convite com protocolo e termo simulados. Convites pendentes
 * permitem aceite ou recusa com confirmação; resultados já gravados abrem em
 * modo somente leitura.
 */
export default function InvitationDetailScreen() {
  const params = useLocalSearchParams<{
    candidateId?: string | string[];
  }>();
  const candidateId = parseCandidateId(params.candidateId);
  const { runAuthenticated } = useSession();
  const [invitation, setInvitation] = useState<StudyInvitation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(candidateId !== null);
  const [reloadKey, setReloadKey] = useState(0);
  const [decision, setDecision] = useState<InvitationDecision | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const candidateIdRef = useRef<number | null>(candidateId);
  const mountedRef = useRef(true);
  const decisionRequestRef = useRef(0);
  const recoveryRef = useRef(false);
  const decisionBlockedRef = useRef(false);
  const previousCandidateIdRef = useRef<number | null>(candidateId);

  candidateIdRef.current = candidateId;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  function refreshInvitation(): void {
    recoveryRef.current = true;
    setReloadKey((key) => key + 1);
  }

  useEffect(() => {
    const candidateChanged = previousCandidateIdRef.current !== candidateId;
    previousCandidateIdRef.current = candidateId;
    if (candidateChanged) {
      decisionRequestRef.current += 1;
      recoveryRef.current = false;
      decisionBlockedRef.current = false;
      setDecision(null);
      setDeciding(false);
      setDecisionError('');
    }

    if (candidateId === null) {
      setInvitation(null);
      setError('');
      setDecision(null);
      setDecisionError('');
      decisionBlockedRef.current = false;
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    const recoveringDecision = recoveryRef.current;
    if (!recoveringDecision) {
      setInvitation(null);
    }
    setLoading(true);
    setError('');

    async function load(id: number): Promise<void> {
      try {
        const result = await runAuthenticated((accessToken) =>
          getInvitation(id, accessToken, controller.signal),
        );
        if (!active) {
          return;
        }
        setInvitation(result);
        if (recoveringDecision) {
          recoveryRef.current = false;
          if (
            normalizeInvitationStatus(result.status) !== 'CONSENT_PENDING' ||
            !decisionBlockedRef.current
          ) {
            setDecisionError('');
          }
        }
      } catch (caught) {
        if (!active || controller.signal.aborted) {
          return;
        }
        if (isHandledSessionError(caught)) {
          return;
        }
        setError(getInvitationLoadErrorMessage(caught, 'detail'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load(candidateId);

    return () => {
      active = false;
      controller.abort();
    };
  }, [candidateId, reloadKey, runAuthenticated]);

  async function sendDecision(
    id: number,
    requested: InvitationDecision,
  ): Promise<StudyInvitation> {
    return runAuthenticated((accessToken) =>
      decideInvitation(id, requested, accessToken),
    );
  }

  async function confirmDecision(): Promise<void> {
    const requested = decision;
    const id = candidateId;
    if (deciding || requested === null || id === null) {
      return;
    }

    const requestId = decisionRequestRef.current + 1;
    decisionRequestRef.current = requestId;
    const isCurrentDecision = (): boolean =>
      mountedRef.current &&
      candidateIdRef.current === id &&
      decisionRequestRef.current === requestId;

    setDeciding(true);
    setDecisionError('');
    decisionBlockedRef.current = false;

    try {
      const updated = await sendDecision(id, requested);
      if (!isCurrentDecision()) {
        return;
      }
      setInvitation(updated);
      setDecision(null);
    } catch (caught) {
      if (!isCurrentDecision()) {
        return;
      }
      setDecision(null);
      if (isHandledSessionError(caught)) {
        return;
      }
      setDecisionError(getInvitationDecisionErrorMessage(caught));
      decisionBlockedRef.current = blocksInvitationDecision(caught);
      if (shouldRefreshInvitationAfterDecisionError(caught)) {
        refreshInvitation();
      }
    } finally {
      if (isCurrentDecision()) {
        setDeciding(false);
      }
    }
  }

  function cancelDecision(): void {
    if (deciding) {
      return;
    }
    setDecision(null);
  }

  const visited = invitation;
  const visits =
    visited && Array.isArray(visited.plannedVisits)
      ? visited.plannedVisits
      : [];
  const startDate = formatCivilDate(visited?.startDate);
  const endDate = formatCivilDate(visited?.endDate);
  const period = [startDate, endDate].filter(Boolean).join(' a ');
  const status = visited
    ? normalizeInvitationStatus(visited.status)
    : 'UNKNOWN';

  return (
    <ScreenContainer>
      <BrandHeader />
      <BackLink
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/invitations');
          }
        }}
      />

      {candidateId === null ? (
        <>
          <MessageBanner
            message={INVITATION_MESSAGES.invalidId}
            tone="error"
          />
          <ActionButton
            label="Voltar aos convites"
            onPress={() => router.replace('/invitations')}
            variant="secondary"
          />
        </>
      ) : null}

      {loading ? (
        <View
          accessibilityLabel="Carregando convite"
          accessibilityRole="progressbar"
          style={styles.loading}
        >
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Carregando convite…</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <>
          <MessageBanner message={error} tone="error" />
          <ActionButton
            label="Tentar novamente"
            onPress={() => setReloadKey((key) => key + 1)}
            variant="secondary"
          />
        </>
      ) : null}

      {!loading && visited !== null ? (
        <>
          <View style={styles.heading}>
            <InvitationStatusBadge status={visited.status} />
            <Text accessibilityRole="header" style={styles.title}>
              {visited.studyTitle}
            </Text>
            <Text style={styles.subtitle}>
              {visited.responsibleName}
              {period ? ` · ${period}` : ''}
            </Text>
          </View>

          {status === 'GRANTED' || status === 'DECLINED' ? (
            <ResultBanner invitation={visited} />
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sobre o estudo</Text>
            <Text style={styles.cardText}>{visited.studyObjective}</Text>
            <View style={styles.metaList}>
              <Text style={styles.meta}>
                <Text style={styles.metaLabel}>Pesquisador responsável: </Text>
                {visited.responsibleName}
              </Text>
              {period ? (
                <Text style={styles.meta}>
                  <Text style={styles.metaLabel}>Período: </Text>
                  {period}
                </Text>
              ) : null}
            </View>
          </View>

          <MessageBanner message={SIMULATION_NOTICE} tone="warning" />

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Visitas previstas
            </Text>
            {visits.length === 0 ? (
              <Text style={styles.muted}>
                Nenhuma visita prevista informada.
              </Text>
            ) : (
              visits.map((visit) => (
                <VisitCard key={visit.id} visit={visit} />
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Termo de participação</Text>
            <Text style={styles.termText}>{visited.termText}</Text>
          </View>

          {status === 'CONSENT_PENDING' ? (
            <View style={styles.decision}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Sua decisão
              </Text>
              {decisionError ? (
                <>
                  <MessageBanner message={decisionError} tone="error" />
                  <ActionButton
                    label="Atualizar convite"
                    onPress={refreshInvitation}
                    variant="secondary"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.muted}>
                    A decisão é única e não poderá ser alterada pelo aplicativo.
                    O aceite não confirma sua inclusão; a equipe responsável fará
                    essa etapa.
                  </Text>
                  <ActionButton
                    accessibilityHint="Abre a confirmação do aceite"
                    disabled={deciding}
                    label="Aceitar convite"
                    onPress={() => setDecision('GRANTED')}
                  />
                  <ActionButton
                    accessibilityHint="Abre a confirmação da recusa"
                    disabled={deciding}
                    label="Recusar convite"
                    onPress={() => setDecision('DECLINED')}
                    variant="secondary"
                  />
                </>
              )}
            </View>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel={decision === 'DECLINED' ? 'Recusar' : 'Aceitar'}
        loading={deciding}
        message={
          decision === null
            ? ''
            : decisionDialogMessage(decision, visited?.studyTitle ?? '')
        }
        onCancel={cancelDecision}
        onConfirm={() => {
          void confirmDecision();
        }}
        title={
          decision === null ? 'Confirmar aceite?' : decisionDialogTitle(decision)
        }
        visible={decision !== null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
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
  decision: {
    gap: spacing.sm + 4,
    paddingTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  visitCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs + 2,
    padding: spacing.md,
  },
  visitHeader: {
    gap: 2,
  },
  visitName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  visitDate: {
    color: colors.brandDark,
    fontSize: 13,
    fontWeight: '600',
  },
  activity: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  termText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  decidedAt: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
