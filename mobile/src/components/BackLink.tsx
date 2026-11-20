import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '../theme/colors';

interface BackLinkProps {
  label?: string;
  onPress: () => void;
}

/** Ação de retorno com alvo de toque confortável e rótulo acessível. */
export function BackLink({ label = 'Voltar', onPress }: BackLinkProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={spacing.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
    >
      <Text style={styles.text}>← {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    color: colors.brandDark,
    fontSize: 15,
    fontWeight: '600',
  },
});
