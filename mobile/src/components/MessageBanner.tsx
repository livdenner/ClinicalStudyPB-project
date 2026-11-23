import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme/colors';

export type BannerTone = 'error' | 'warning' | 'info' | 'success' | 'neutral';

interface MessageBannerProps {
  tone: BannerTone;
  message: string;
}

const symbols: Record<BannerTone, string> = {
  error: '!',
  warning: '!',
  info: 'i',
  success: '✓',
  neutral: '•',
};

const backgrounds: Record<BannerTone, string> = {
  error: colors.errorSoft,
  warning: colors.warningSoft,
  info: colors.infoSoft,
  success: colors.successSoft,
  neutral: colors.neutralSoft,
};

const textColors: Record<BannerTone, string> = {
  error: colors.error,
  warning: colors.warning,
  info: colors.info,
  success: colors.success,
  neutral: colors.textMuted,
};

/**
 * Aviso textual com cor de apoio e símbolo, sem depender apenas da cor para
 * transmitir o significado.
 */
export function MessageBanner({ tone, message }: MessageBannerProps) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[styles.container, { backgroundColor: backgrounds[tone] }]}
    >
      <Text style={[styles.symbol, { color: textColors[tone] }]}>
        {symbols[tone]}
      </Text>
      <Text style={[styles.message, { color: textColors[tone] }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    borderRadius: radii.sm + 2,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm + 4,
  },
  symbol: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
    width: 16,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
