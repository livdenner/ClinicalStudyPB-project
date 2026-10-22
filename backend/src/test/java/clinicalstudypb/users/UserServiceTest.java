package clinicalstudypb.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.EmailAlreadyInUseException;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.users.infrastructure.PasswordEncodingConfig;
import clinicalstudypb.users.infrastructure.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Verifica as regras de usuário com repositório simulado e codificação real de senha.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    private PasswordEncoder passwordEncoder;
    private UserService userService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new PasswordEncodingConfig().passwordEncoder();
        userService = new UserService(userRepository, passwordEncoder);
    }

    @Test
    void createUserNormalizesEmailAndStoresDelegatingBcryptHash() {
        String password = "Demo@Clinical2026";
        userService.createUser("  Pesquisador  ", "  PESQUISADOR@EXAMPLE.COM  ", password, UserRole.RESEARCHER);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();
        String passwordHash = (String) ReflectionTestUtils.getField(saved, "passwordHash");

        assertEquals("Pesquisador", saved.getName());
        assertEquals("pesquisador@example.com", saved.getEmail());
        assertTrue(passwordHash.startsWith("{bcrypt}"));
        assertTrue(passwordEncoder.matches(password, passwordHash));
    }

    @Test
    void delegatingEncoderAcceptsExistingDemoUserHash() {
        String seededHash = "{bcrypt}$2b$12$Ak2Pnw/d5Ki3Ebyo/TORYuch09SON34Ph1iVoOtTl/41Nlk619nGO";

        assertTrue(passwordEncoder.matches("Demo@Clinical2026", seededHash));
    }

    @Test
    void createUserRejectsEmailAlreadyInUseIgnoringCase() {
        when(userRepository.existsByEmailIgnoreCase("pesquisador@example.com")).thenReturn(true);

        assertThrows(EmailAlreadyInUseException.class,
                () -> userService.createUser("Outro", "Pesquisador@Example.com", "senha", UserRole.RESEARCHER));

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateUserPreservesDataWhenNewEmailIsAlreadyInUse() {
        User user = new User("Nome original", "original@example.com", "{bcrypt}hash", UserRole.RESEARCHER);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.existsByEmailIgnoreCase("outro@example.com")).thenReturn(true);

        assertThrows(EmailAlreadyInUseException.class,
                () -> userService.updateUser(1L, "Novo nome", "Outro@Example.com", UserRole.COORDINATOR));

        assertEquals("Nome original", user.getName());
        assertEquals("original@example.com", user.getEmail());
        assertEquals(UserRole.RESEARCHER, user.getRole());
    }
}
