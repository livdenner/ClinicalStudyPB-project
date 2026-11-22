import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme/colors';
import { ActionButton } from './ActionButton';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal reutilizável para confirmar ações sem toque acidental. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (!loading) {
          onCancel();
        }
      }}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={styles.card}
          testID="confirm-dialog"
        >
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <ActionButton
            label={confirmLabel}
            loading={loading}
            onPress={onConfirm}
          />
          <ActionButton
            disabled={loading}
            label={cancelLabel}
            onPress={onCancel}
            variant="secondary"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(22, 41, 45, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.lg,
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
});
