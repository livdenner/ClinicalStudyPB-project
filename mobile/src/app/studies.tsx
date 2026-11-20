import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { BrandHeader } from '../components/BrandHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing } from '../theme/colors';

/**
 * Destino provisório protegido. A listagem real de estudos do participante
 * será implementada em uma entrega posterior; o acesso já exige sessão ativa.
 */
export default function StudiesScreen() {
  return (
    <ScreenContainer>
      <BrandHeader />

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Estudos
        </Text>
        <Text style={styles.subtitle}>
          Esta tela é apenas um destino provisório para demonstrar a navegação.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Em breve</Text>
        <Text style={styles.cardText}>
          Seus estudos e visitas aparecerão aqui em uma próxima atualização do
          aplicativo.
        </Text>
      </View>

      <ActionButton
        label="Voltar ao início"
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}
        variant="secondary"
      />
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  cardText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
