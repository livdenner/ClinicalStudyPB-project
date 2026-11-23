import {
  getParticipationStatusVisual,
  participationStatusLabel,
} from '../../services/studies/studyPresentation';
import { StatusBadge } from '../StatusBadge';

interface ParticipationStatusBadgeProps {
  status: string;
}

/**
 * Selo semântico da situação da participação do usuário no estudo
 * (`ACTIVE` informativo ou `WITHDRAWN` neutro).
 */
export function ParticipationStatusBadge({
  status,
}: ParticipationStatusBadgeProps) {
  const label = participationStatusLabel(status);
  const visual = getParticipationStatusVisual(status);

  return (
    <StatusBadge
      accessibilityLabel={`Situação da participação: ${label}`}
      backgroundColor={visual.backgroundColor}
      borderColor={visual.borderColor}
      label={label}
      symbol={visual.symbol}
      textColor={visual.textColor}
    />
  );
}
