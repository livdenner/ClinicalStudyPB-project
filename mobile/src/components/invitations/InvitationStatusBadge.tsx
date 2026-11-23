import { StyleSheet, Text, View } from 'react-native';

import {
  invitationStatusLabel,
  normalizeInvitationStatus,
  type InvitationDisplayStatus,
} from '../../services/invitations/invitationPresentation';
import { colors, radii, spacing } from '../../theme/colors';

const backgrounds: Record<InvitationDisplayStatus, string> = {
  CONSENT_PENDING: colors.warningSoft,
  GRANTED: colors.successSoft,
  DECLINED: colors.neutralSoft,
  UNKNOWN: colors.neutralSoft,
};

const textColors: Record<InvitationDisplayStatus, string> = {
  CONSENT_PENDING: colors.warning,
  GRANTED: colors.success,
  DECLINED: colors.textMuted,
  UNKNOWN: colors.textMuted,
};

interface InvitationStatusBadgeProps {
  status: string;
}

/**
 * Situação do convite com rótulo textual. O verde de sucesso só aparece
 * depois de o servidor registrar o aceite; recusa usa tratamento neutro.
 */
export function InvitationStatusBadge({
  status,
}: InvitationStatusBadgeProps) {
  const normalized = normalizeInvitationStatus(status);

  return (
    <View
      accessibilityLabel={`Situação: ${invitationStatusLabel(status)}`}
      style={[styles.badge, { backgroundColor: backgrounds[normalized] }]}
    >
      <Text style={[styles.text, { color: textColors[normalized] }]}>
        {invitationStatusLabel(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
