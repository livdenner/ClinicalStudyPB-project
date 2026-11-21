import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '../theme/colors';

interface StatusBadgeProps {
  label: string;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  symbol?: string;
  accessibilityLabel?: string;
}

/**
 * Selo reutilizável com rótulo visível e apoio de símbolo, evitando depender
 * apenas da cor para comunicar estado.
 */
export function StatusBadge({
  label,
  backgroundColor,
  textColor,
  borderColor,
  symbol,
  accessibilityLabel,
}: StatusBadgeProps) {
  return (
    <View
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.badge,
        { backgroundColor },
        borderColor ? { borderColor, borderWidth: 1 } : null,
      ]}
    >
      {symbol ? (
        <Text
          accessible={false}
          importantForAccessibility="no"
          style={[styles.symbol, { color: textColor }]}
        >
          {symbol}
        </Text>
      ) : null}
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  symbol: {
    fontSize: 11,
    fontWeight: '700',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
