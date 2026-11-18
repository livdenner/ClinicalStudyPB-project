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

/**
 * Emite códigos de ativação de alta entropia e persiste apenas o hash.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@Service
public class CandidateInvitationService {

    private final SecureRandom random = new SecureRandom();
    private final CandidateActivationInviteRepository repository;

    /**
     * Inicializa o serviço com o repositório de convites de ativação.
     *
     * @param repository repositório JPA dos convites persistidos
     */
    public CandidateInvitationService(CandidateActivationInviteRepository repository) {
        this.repository = repository;
    }

    /**
     * Substitui qualquer código anterior e devolve o novo somente nesta chamada.
     *
     * @param userId identificador da conta convidada
     * @return código em texto claro recém-gerado e seu instante de expiração
     */
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

    /**
     * Busca o convite associado à conta informada.
     *
     * @param userId identificador da conta do candidato
     * @return convite encontrado ou vazio quando inexistente
     */
    public Optional<CandidateActivationInvite> find(Long userId) {
        return repository.findById(userId);
    }

    /**
     * Remove o convite ainda não utilizado da conta sem apagar o usuário.
     * Apagar o registro em vez de recuar o prazo faz o fluxo de ativação devolver
     * {@code ACTIVATION_INVALID}, e não {@code ACTIVATION_EXPIRED}.
     *
     * @param userId identificador da conta do candidato
     */
    public void invalidate(Long userId) {
        repository.findById(userId).ifPresent(invite -> {
            if (invite.getUsedAt() == null) {
                repository.delete(invite);
                repository.flush();
            }
        });
    }

    /**
     * Consome o convite pendente da conta quando a senha é definida.
     *
     * @param userId identificador da conta recém-ativada
     */
    public void consume(Long userId) {
        repository.findById(userId).ifPresent(invite -> {
            invite.markUsed(Instant.now().truncatedTo(ChronoUnit.MICROS));
            repository.saveAndFlush(invite);
        });
    }

    /**
     * Compara o código recebido com o hash salvo sem usar comparação de tempo variável.
     *
     * @param invitation convite persistido com o hash esperado
     * @param code código informado pelo participante
     * @return {@code true} quando o código corresponde ao hash armazenado
     */
    public boolean matches(CandidateActivationInvite invitation, String code) {
        byte[] expected = HexFormat.of().parseHex(invitation.getCodeHash());
        byte[] provided = HexFormat.of().parseHex(sha256(code));
        return MessageDigest.isEqual(expected, provided);
    }

    private String sha256(String code) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(code.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 não disponível", exception);
        }
    }

    /**
     * Código exibido ao coordenador apenas na resposta que o gerou.
     *
     * @param value código de ativação em texto claro
     * @param expiresAt instante de expiração do convite
     */
    public record IssuedCode(String value, Instant expiresAt) {
        @Override
        public String toString() {
            return "IssuedCode[redacted]";
        }
    }
}
