package clinicalstudypb.users.domain;

/**
 * Perfis de acesso previstos para os usuários da Sprint 1.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
public enum UserRole {
    /** Pesquisador responsável por atividades de pesquisa. */
    RESEARCHER,
    /** Coordenador responsável pela condução de estudos. */
    COORDINATOR,
    /** Administrador responsável pela gestão de usuários. */
    ADMINISTRATOR,
    /** Participante que acompanha sua participação no estudo. */
    PARTICIPANT
}
