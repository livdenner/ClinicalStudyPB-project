package clinicalstudypb.auth.infrastructure;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import java.util.Base64;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/** Configura a chave de assinatura e os componentes de emissão e validação de JWT.
 *
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
@Configuration
public class JwtConfiguration {

    private static final String ISSUER = "clinicalstudypb";
    private static final String KEY_ID = "clinicalstudypb-hs256";

    /**
     * Constrói uma chave HS256 a partir de uma variável de ambiente Base64.
     *
     * @param encodedSecret chave em Base64
     * @return chave HMAC-SHA-256
     */
    @Bean
    public SecretKey jwtSecretKey(@Value("${app.security.jwt.secret-base64}") String encodedSecret) {
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(encodedSecret);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("JWT_SECRET_BASE64 precisa conter uma chave Base64 válida.", exception);
        }
        if (keyBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET_BASE64 deve representar pelo menos 32 bytes aleatórios.");
        }
        return new SecretKeySpec(keyBytes, "HmacSHA256");
    }

    /**
     * Cria o codificador de JWT assinado com a chave configurada.
     *
     * @param secretKey chave HS256
     * @return codificador JWT
     */
    @Bean
    public JwtEncoder jwtEncoder(SecretKey secretKey) {
        OctetSequenceKey jwk = new OctetSequenceKey.Builder(secretKey)
                .keyID(KEY_ID)
                .build();
        JWKSource<SecurityContext> jwkSource = new ImmutableJWKSet<>(new JWKSet(jwk));
        return new NimbusJwtEncoder(jwkSource);
    }

    /**
     * Cria o decodificador que valida assinatura, validade e emissor dos tokens recebidos.
     *
     * @param secretKey chave HS256
     * @return decodificador JWT
     */
    @Bean
    public JwtDecoder jwtDecoder(SecretKey secretKey) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
        return decoder;
    }
}
