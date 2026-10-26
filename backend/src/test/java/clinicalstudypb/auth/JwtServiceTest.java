package clinicalstudypb.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import clinicalstudypb.auth.application.JwtService;
import clinicalstudypb.auth.application.JwtToken;
import clinicalstudypb.auth.infrastructure.JwtConfiguration;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Verifica a emissão de JWT com o codificador e o decodificador reais da configuração de segurança.
 *
 * @author Júlia Pamplona
 * @since 2026-10-25
 * @version 0.0.1
 */
class JwtServiceTest {

    private static final long EXPIRATION_SECONDS = 3600;

    private final JwtConfiguration configuration = new JwtConfiguration();
    private JwtService jwtService;
    private JwtDecoder jwtDecoder;

    @BeforeEach
    void setUp() {
        SecretKey secretKey = configuration.jwtSecretKey(encodedSecret("0123456789abcdef0123456789abcdef"));
        jwtService = new JwtService(configuration.jwtEncoder(secretKey), EXPIRATION_SECONDS);
        jwtDecoder = configuration.jwtDecoder(secretKey);
    }

    @Test
    void issuedTokenCarriesIssuerSubjectUserIdAndRole_CA02_1() {
        JwtToken token = jwtService.issue(coordinator());

        Jwt jwt = jwtDecoder.decode(token.value());

        assertEquals("clinicalstudypb", jwt.getClaimAsString("iss"));
        assertEquals("coordenador@clinicalstudypb.test", jwt.getSubject());
        assertEquals(42L, ((Number) jwt.getClaim("userId")).longValue());
        assertEquals("COORDINATOR", jwt.getClaimAsString("role"));
        assertEquals("HS256", jwt.getHeaders().get("alg"));
    }

    @Test
    void issuedTokenExpiresAfterConfiguredSeconds() {
        JwtToken token = jwtService.issue(coordinator());

        Jwt jwt = jwtDecoder.decode(token.value());

        assertEquals(EXPIRATION_SECONDS, token.expiresIn());
        assertEquals(EXPIRATION_SECONDS, jwt.getExpiresAt().getEpochSecond() - jwt.getIssuedAt().getEpochSecond());
    }

    @Test
    void tamperedPayloadIsRejectedByDecoder_CA02_5() {
        String[] parts = jwtService.issue(coordinator()).value().split("\\.");
        String forgedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"iss\":\"clinicalstudypb\",\"sub\":\"coordenador@clinicalstudypb.test\",\"role\":\"ADMINISTRATOR\"}"
                        .getBytes(StandardCharsets.UTF_8));
        String tampered = parts[0] + "." + forgedPayload + "." + parts[2];

        assertThrows(JwtException.class, () -> jwtDecoder.decode(tampered));
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected_CA02_5() {
        SecretKey otherKey = configuration.jwtSecretKey(encodedSecret("fedcba9876543210fedcba9876543210"));
        JwtService otherService = new JwtService(configuration.jwtEncoder(otherKey), EXPIRATION_SECONDS);

        String foreignToken = otherService.issue(coordinator()).value();

        assertThrows(JwtException.class, () -> jwtDecoder.decode(foreignToken));
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1})
    void nonPositiveExpirationIsRejected(long expirationSeconds) {
        SecretKey secretKey = configuration.jwtSecretKey(encodedSecret("0123456789abcdef0123456789abcdef"));

        assertThrows(IllegalArgumentException.class,
                () -> new JwtService(configuration.jwtEncoder(secretKey), expirationSeconds));
    }

    private User coordinator() {
        User user = new User("Coordenador Demo", "coordenador@clinicalstudypb.test", "{bcrypt}hash",
                UserRole.COORDINATOR);
        ReflectionTestUtils.setField(user, "id", 42L);
        return user;
    }

    private static String encodedSecret(String rawSecret) {
        return Base64.getEncoder().encodeToString(rawSecret.getBytes(StandardCharsets.UTF_8));
    }
}
