import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme/colors';

interface BrandHeaderProps {
  showTagline?: boolean;
  align?: 'start' | 'center';
}

/**
 * Identidade visual compacta usada no topo das telas nativas. A variante
 * centralizada é usada no cartão de login, como no protótipo.
 */
export function BrandHeader({
  showTagline = false,
  align = 'start',
}: BrandHeaderProps) {
  return (
    <View
      accessible
      accessibilityLabel={
        showTagline
          ? 'ClinicalStudyPB, gestão de pesquisa'
          : 'ClinicalStudyPB'
      }
      accessibilityRole="header"
      style={[styles.container, align === 'center' ? styles.centered : null]}
    >
      <View style={styles.mark}>
        <View style={styles.plusHorizontal} />
        <View style={styles.plusVertical} />
      </View>
      <View style={[styles.labels, align === 'center' ? styles.labelsCentered : null]}>
        <Text style={styles.name}>ClinicalStudyPB</Text>
        {showTagline ? (
          <Text style={styles.tagline}>GESTÃO DE PESQUISA</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm + 4,
  },
  centered: {
    justifyContent: 'center',
  },
  mark: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  plusHorizontal: {
    backgroundColor: colors.surface,
    borderRadius: 2,
    height: 5,
    position: 'absolute',
    width: 24,
  },
  plusVertical: {
    backgroundColor: colors.surface,
    borderRadius: 2,
    height: 24,
    position: 'absolute',
    width: 5,
  },
  labels: {
    gap: 2,
  },
  labelsCentered: {
    alignItems: 'flex-start',
  },
  name: {
    color: colors.brandDark,
    fontSize: 20,
    fontWeight: '700',
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
});
