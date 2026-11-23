import { StyleSheet, Text, View } from 'react-native';

import { formatCivilDate } from '../../services/format/dateFormat';
import type { PlannedVisit } from '../../services/protocol/protocolTypes';
import { colors, radii, spacing } from '../../theme/colors';

interface PlannedVisitCardProps {
  visit: PlannedVisit;
  datePrefix?: string;
}

/**
 * Cartão compartilhado de visita prevista do protocolo e suas atividades.
 * Reutilizado nos detalhes de convites e estudos, mantendo a data civil sem
 * conversão de fuso horário.
 */
export function PlannedVisitCard({ visit, datePrefix }: PlannedVisitCardProps) {
  const plannedDate = formatCivilDate(visit.plannedDate);
  const activities = Array.isArray(visit.activities) ? visit.activities : [];
  const dateLabel = plannedDate
    ? datePrefix
      ? `${datePrefix}: ${plannedDate}`
      : plannedDate
    : datePrefix
      ? `${datePrefix} não informada`
      : 'Data não informada';

  return (
    <View style={styles.visitCard}>
      <View style={styles.visitHeader}>
        <Text style={styles.visitName}>{visit.name}</Text>
        <Text style={styles.visitDate}>{dateLabel}</Text>
      </View>
      {activities.length === 0 ? (
        <Text style={styles.muted}>Sem atividades previstas.</Text>
      ) : (
        activities.map((activity) => (
          <Text key={activity.id} style={styles.activity}>
            {`• ${activity.name}${
              activity.description ? ` — ${activity.description}` : ''
            }`}
          </Text>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
