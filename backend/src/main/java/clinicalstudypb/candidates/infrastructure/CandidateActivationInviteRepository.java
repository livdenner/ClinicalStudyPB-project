package clinicalstudypb.candidates.infrastructure;

import clinicalstudypb.candidates.domain.CandidateActivationInvite;
import org.springframework.data.jpa.repository.JpaRepository;

/** Persistência do convite de ativação da conta de participante. */
public interface CandidateActivationInviteRepository extends JpaRepository<CandidateActivationInvite, Long> {
}
