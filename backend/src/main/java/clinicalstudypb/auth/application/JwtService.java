package clinicalstudypb.auth.application;

import clinicalstudypb.users.domain.User;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

/** Emite JWTs assinados para contas autenticadas.
 *
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
@Service
public class JwtService {

    private static final String ISSUER = "clinicalstudypb";

    private final JwtEncoder jwtEncoder;
    private final long expirationSeconds;

    /**
     * Cria o serviço de emissão de tokens com validade configurável.
     *
     * @param jwtEncoder codificador JWT do Spring Security
     * @param expirationSeconds validade do token em segundos
     */
    public JwtService(
            JwtEncoder jwtEncoder,
            @Value("${app.security.jwt.expiration-seconds}") long expirationSeconds
    ) {
        if (expirationSeconds <= 0) {
            throw new IllegalArgumentException("A validade do JWT deve ser positiva.");
        }
        this.jwtEncoder = jwtEncoder;
        this.expirationSeconds = expirationSeconds;
    }

    /**
     * Emite um token com identificador, e-mail e perfil da conta.
     *
     * @param user conta autenticada
     * @return token assinado e sua validade
     */
    public JwtToken issue(User user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(expirationSeconds);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(user.getEmail())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .claim("userId", user.getId())
                .claim("role", user.getRole().name())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new JwtToken(token, expirationSeconds);
    }
}
