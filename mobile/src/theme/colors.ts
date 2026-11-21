/**
 * Tokens nativos alinhados à identidade do ClinicalStudyPB e à tabela semântica
 * do PBI-24. O verde-petróleo da marca é usado em ações e navegação; o verde de
 * sucesso continua reservado a confirmações de resultado.
 */
export const colors = {
  brand: '#0F766E',
  brandDark: '#0B5C56',
  background: '#F4F6F5',
  surface: '#FFFFFF',
  border: '#DCE5E1',
  text: '#16292D',
  textMuted: '#5E6E6C',
  success: '#1B7F4B',
  successSoft: '#E6F4EA',
  error: '#B3261E',
  errorSoft: '#FCE9E7',
  warning: '#8A5A00',
  warningSoft: '#FFF3D6',
  info: '#0B5FA5',
  infoSoft: '#E6F1FB',
  neutral: '#475569',
  neutralSoft: '#EEF2F1',
  neutralBorder: '#CBD5E1',
  studyRecruitment: '#5B3A91',
  studyRecruitmentSoft: '#EDE9FE',
  studyClosed: '#334155',
  studyClosedSoft: '#E2E8F0',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;
