package clinicalstudypb.consent.domain;

/**
 * Estado público do consentimento simulado, inclusive antes do registro.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.1
 */
public enum ConsentStatus {
    /** Nenhuma decisão foi registrada. */
    PENDING,
    /** Decisão favorável registrada. */
    GRANTED,
    /** Decisão contrária registrada. */
    DECLINED
}
