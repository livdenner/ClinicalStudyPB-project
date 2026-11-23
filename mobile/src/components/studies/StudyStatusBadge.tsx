import {
  getStudyStatusVisual,
  studyStatusLabel,
} from '../../services/studies/studyPresentation';
import { StatusBadge } from '../StatusBadge';

interface StudyStatusBadgeProps {
  status: string;
}

/**
 * Selo semântico do estado do estudo conforme a tabela do PBI-24.
 * Mantém o conceito separado da situação de participação.
 */
export function StudyStatusBadge({ status }: StudyStatusBadgeProps) {
  const label = studyStatusLabel(status);
  const visual = getStudyStatusVisual(status);

  return (
    <StatusBadge
      accessibilityLabel={`Estado do estudo: ${label}`}
      backgroundColor={visual.backgroundColor}
      borderColor={visual.borderColor}
      label={label}
      symbol={visual.symbol}
      textColor={visual.textColor}
    />
  );
}
