package clinicalstudypb.users.infrastructure;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Preserva senhas Unicode completas quando ultrapassam o limite de entrada do BCrypt. */
final class Utf8SafePasswordEncoder implements PasswordEncoder {

    private static final int BCRYPT_MAX_BYTES = 72;
    private static final String BCRYPT_PREFIX = "{bcrypt}";
    private static final String PREHASHED_PREFIX = "{bcrypt-sha256}";

    private final PasswordEncoder delegate;

    Utf8SafePasswordEncoder(PasswordEncoder delegate) {
        this.delegate = delegate;
    }

    @Override
    public String encode(CharSequence rawPassword) {
        String raw = rawPassword.toString();
        if (raw.getBytes(StandardCharsets.UTF_8).length <= BCRYPT_MAX_BYTES) {
            return delegate.encode(raw);
        }
        String encoded = delegate.encode(prehash(raw));
        return PREHASHED_PREFIX + encoded.substring(BCRYPT_PREFIX.length());
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (encodedPassword != null && encodedPassword.startsWith(PREHASHED_PREFIX)) {
            String bcryptHash = BCRYPT_PREFIX + encodedPassword.substring(PREHASHED_PREFIX.length());
            return delegate.matches(prehash(rawPassword.toString()), bcryptHash);
        }
        return delegate.matches(rawPassword, encodedPassword);
    }

    @Override
    public boolean upgradeEncoding(String encodedPassword) {
        if (encodedPassword != null && encodedPassword.startsWith(PREHASHED_PREFIX)) {
            String bcryptHash = BCRYPT_PREFIX + encodedPassword.substring(PREHASHED_PREFIX.length());
            return delegate.upgradeEncoding(bcryptHash);
        }
        return delegate.upgradeEncoding(encodedPassword);
    }

    private String prehash(String password) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(password.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 não disponível", exception);
        }
    }
}
