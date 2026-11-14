package clinicalstudypb.users.domain;

/** Indica que contas de participantes não são administradas por /api/users. */
public class ParticipantRoleNotAllowedException extends RuntimeException {

    /** Cria o erro de perfil incompatível com as rotas administrativas. */
    public ParticipantRoleNotAllowedException() {
        super("Contas de participantes são gerenciadas pelo cadastro de candidatos.");
    }
}
