package clinicalstudypb.candidates.application;

import clinicalstudypb.candidates.domain.CandidateActivationInvite;
import clinicalstudypb.candidates.infrastructure.CandidateActivationInviteRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.stereotype.Service;

/** Emite códigos de ativação de alta entropia e persiste apenas o hash. */
@Service
public class CandidateInvitationService {

    private final SecureRandom random = new SecureRandom();
    private final CandidateActivationInviteRepository repository;

    public CandidateInvitationService(CandidateActivationInviteRepository repository) {
        this.repository = repository;
    }

    /** Substitui qualquer código anterior e devolve o novo somente nesta chamada. */
    public IssuedCode issue(Long userId) {
        byte[] bytes = new byte[20];
        random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hash = sha256(code);
        Instant created = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant expires = created.plus(72, ChronoUnit.HOURS);
        CandidateActivationInvite invite = repository.findById(userId).orElse(null);
        if (invite == null) {
            invite = new CandidateActivationInvite(userId, hash, created, expires);
        } else {
            invite.replace(hash, created, expires);
        }
        repository.saveAndFlush(invite);
        return new IssuedCode(code, expires);
    }

    public Optional<CandidateActivationInvite> find(Long userId) {
        return repository.findById(userId);
    }

    /**
     * Remove o convite ainda não utilizado da conta sem apagar o usuário.
     * Apagar o registro em vez de recuar o prazo faz o fluxo de ativação devolver
     * {@code ACTIVATION_INVALID}, e não {@code ACTIVATION_EXPIRED}.
     */
    public void invalidate(Long userId) {
        repository.findById(userId).ifPresent(invite -> {
            if (invite.getUsedAt() == null) {
                repository.delete(invite);
                repository.flush();
            }
        });
    }

    private String sha256(String code) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(code.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 não disponível", exception);
        }
    }

    /** Código exibido ao coordenador apenas na resposta que o gerou. */
    public record IssuedCode(String value, Instant expiresAt) {
        @Override
        public String toString() {
            return "IssuedCode[redacted]";
        }
    }
}
