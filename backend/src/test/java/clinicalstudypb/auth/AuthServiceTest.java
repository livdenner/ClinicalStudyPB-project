package clinicalstudypb.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.auth.application.AuthService;
import clinicalstudypb.auth.application.JwtService;
import clinicalstudypb.auth.application.JwtToken;
import clinicalstudypb.auth.domain.InvalidCredentialsException;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.users.infrastructure.PasswordEncodingConfig;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Verifica o caso de uso de login com usuários e emissão de token simulados e senha codificada de verdade.
 *
 * @author Júlia Pamplona
 * @since 2026-10-25
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String EMAIL = "pesquisador@clinicalstudypb.test";
    private static final String PASSWORD = "Demo@Clinical2026";

    @Mock
    private UserService userService;

    @Mock
    private JwtService jwtService;

    private PasswordEncoder passwordEncoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new PasswordEncodingConfig().passwordEncoder();
        authService = new AuthService(userService, passwordEncoder, jwtService);
    }

    @Test
    void loginWithValidCredentialsReturnsTokenAndUser_CA02_1() {
        User user = activeResearcher();
        JwtToken token = new JwtToken("jwt-assinado", 3600);
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(jwtService.issue(user)).thenReturn(token);

        AuthService.AuthenticatedUser authenticated = authService.login(EMAIL, PASSWORD);

        assertSame(token, authenticated.token());
        assertSame(user, authenticated.user());
    }

    @Test
    void loginNormalizesEmailBeforeLookup() {
        User user = activeResearcher();
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(jwtService.issue(user)).thenReturn(new JwtToken("jwt-assinado", 3600));

        authService.login("  Pesquisador@ClinicalStudyPB.TEST  ", PASSWORD);

        verify(userService).findByEmail(EMAIL);
    }

    @Test
    void loginWithUnknownEmailIsRejectedWithoutIssuingToken_CA02_2() {
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThrows(InvalidCredentialsException.class, () -> authService.login(EMAIL, PASSWORD));

        verify(jwtService, never()).issue(any(User.class));
    }

    @Test
    void loginWithWrongPasswordIsRejectedWithoutIssuingToken_CA02_2() {
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.of(activeResearcher()));

        assertThrows(InvalidCredentialsException.class, () -> authService.login(EMAIL, "senha-errada"));

        verify(jwtService, never()).issue(any(User.class));
    }

    @Test
    void unknownEmailAndWrongPasswordProduceTheSameMessage_CA02_2() {
        when(userService.findByEmail("inexistente@clinicalstudypb.test")).thenReturn(Optional.empty());
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.of(activeResearcher()));

        InvalidCredentialsException unknownEmail = assertThrows(InvalidCredentialsException.class,
                () -> authService.login("inexistente@clinicalstudypb.test", PASSWORD));
        InvalidCredentialsException wrongPassword = assertThrows(InvalidCredentialsException.class,
                () -> authService.login(EMAIL, "senha-errada"));

        assertEquals(unknownEmail.getMessage(), wrongPassword.getMessage());
    }

    @Test
    void inactiveUserWithCorrectPasswordIsRejected_CA02_3() {
        User user = activeResearcher();
        user.deactivate();
        when(userService.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        assertThrows(InvalidCredentialsException.class, () -> authService.login(EMAIL, PASSWORD));

        verify(jwtService, never()).issue(any(User.class));
    }

    private User activeResearcher() {
        return new User("Pesquisador Demo", EMAIL, passwordEncoder.encode(PASSWORD), UserRole.RESEARCHER);
    }
}
