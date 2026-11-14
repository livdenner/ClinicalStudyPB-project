package clinicalstudypb.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.auth.application.AuthService;
import clinicalstudypb.auth.application.JwtService;
import clinicalstudypb.auth.application.JwtToken;
import clinicalstudypb.auth.application.PasswordChangeService;
import clinicalstudypb.auth.domain.InvalidCredentialsException;
import clinicalstudypb.auth.domain.PasswordChangeException;
import clinicalstudypb.candidates.application.CandidateInvitationService;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.users.infrastructure.PasswordEncodingConfig;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/** Verifica as regras de definição inicial e alteração de senha. */
@ExtendWith(MockitoExtension.class)
class PasswordChangeServiceTest {

    private static final Long USER_ID = 15L;
    private static final String EMAIL = "participante@clinicalstudypb.test";
    private static final String OLD_PASSWORD = "Demo@Clinical2026";
    private static final String VALID_PASSWORD = "NovaSenha2026";

    @Mock
    private CurrentActor currentActor;

    @Mock
    private UserService userService;

    @Mock
    private CandidateInvitationService invitationService;

    @Mock
    private JwtService jwtService;

    private PasswordEncoder passwordEncoder;
    private PasswordChangeService service;

    @BeforeEach
    void setUp() {
        passwordEncoder = new PasswordEncodingConfig().passwordEncoder();
        service = new PasswordChangeService(
                currentActor, userService, invitationService, passwordEncoder, jwtService);
        when(currentActor.userId()).thenReturn(USER_ID);
    }

    @Test
    void firstAccessSetsPasswordClearsPendingFlagAndConsumesInvite() {
        User participant = invitedStartedUser();
        JwtToken unrestricted = new JwtToken("jwt-irrestrito", 3600);
        when(userService.findLockedById(USER_ID)).thenReturn(Optional.of(participant));
        when(jwtService.issue(participant)).thenReturn(unrestricted);

        AuthService.AuthenticatedUser result = service.changePassword(null, VALID_PASSWORD);

        assertSame(unrestricted, result.token());
        assertTrue(participant.isActive());
        assertFalse(participant.isActivationPending());
        assertTrue(passwordEncoder.matches(VALID_PASSWORD, participant.getPasswordHash()));
        verify(invitationService).consume(USER_ID);
    }

    @Test
    void regularUserChangesPasswordWhenCurrentPasswordMatches() {
        User researcher = regularUser();
        String previousHash = researcher.getPasswordHash();
        JwtToken renewed = new JwtToken("jwt-renovado", 3600);
        when(userService.findLockedById(USER_ID)).thenReturn(Optional.of(researcher));
        when(jwtService.issue(researcher)).thenReturn(renewed);

        AuthService.AuthenticatedUser result = service.changePassword(OLD_PASSWORD, VALID_PASSWORD);

        assertSame(renewed, result.token());
        assertNotEquals(previousHash, researcher.getPasswordHash());
        assertTrue(passwordEncoder.matches(VALID_PASSWORD, researcher.getPasswordHash()));
        verify(invitationService, never()).consume(any());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"senha-errada", " "})
    void regularUserWithMissingOrWrongCurrentPasswordIsRejected(String currentPassword) {
        User researcher = regularUser();
        String originalHash = researcher.getPasswordHash();
        when(userService.findLockedById(USER_ID)).thenReturn(Optional.of(researcher));

        PasswordChangeException error = assertThrows(PasswordChangeException.class,
                () -> service.changePassword(currentPassword, VALID_PASSWORD));

        assertEquals("CURRENT_PASSWORD_INVALID", error.getCode());
        assertEquals(originalHash, researcher.getPasswordHash());
        verify(jwtService, never()).issue(any());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"Ab12345", "SomenteLetras", "12345678", "        "})
    void weakPasswordIsRejectedWithoutConsumingInviteOrChangingHash(String candidatePassword) {
        User participant = invitedStartedUser();
        String originalHash = participant.getPasswordHash();
        when(userService.findLockedById(USER_ID)).thenReturn(Optional.of(participant));

        PasswordChangeException error = assertThrows(PasswordChangeException.class,
                () -> service.changePassword(null, candidatePassword));

        assertEquals("PASSWORD_POLICY", error.getCode());
        assertTrue(participant.isActivationPending());
        assertEquals(originalHash, participant.getPasswordHash());
        verify(invitationService, never()).consume(any());
        verify(jwtService, never()).issue(any());
    }

    @Test
    void passwordBoundaryLengthsAt8And72AreAccepted() {
        for (String boundaryPassword : List.of("Ab123456", "A1" + "a".repeat(70))) {
            User researcher = regularUser();
            when(userService.findLockedById(USER_ID)).thenReturn(Optional.of(researcher));
            when(jwtService.issue(researcher)).thenReturn(new JwtToken("jwt-limite", 3600));

            service.changePassword(OLD_PASSWORD, boundaryPassword);
            assertTrue(passwordEncoder.matches(boundaryPassword, researcher.getPasswordHash()));
        }
    }

    @Test
    void passwordOver72CharactersIsRejected() {
        User participant = invitedStartedUser();
        when(userService.findLockedById(USER_ID)).thenReturn(Optional.of(participant));

        String overChars = "A1" + "a".repeat(71);
        assertEquals("PASSWORD_POLICY", assertThrows(PasswordChangeException.class,
                () -> service.changePassword(null, overChars)).getCode());
    }

    @Test
    void unicodePasswordWithin72CharactersUsesAllItsUtf8Bytes() {
        User participant = invitedStartedUser();
        when(userService.findLockedById(USER_ID)).thenReturn(Optional.of(participant));
        when(jwtService.issue(participant)).thenReturn(new JwtToken("jwt-unicode", 3600));
        String password = "A1" + "ç".repeat(70);

        service.changePassword(null, password);

        assertTrue(participant.getPasswordHash().startsWith("{bcrypt-sha256}"));
        assertTrue(passwordEncoder.matches(password, participant.getPasswordHash()));
        assertFalse(passwordEncoder.matches("A1" + "ç".repeat(69) + "a", participant.getPasswordHash()));
    }

    @Test
    void missingOrDeactivatedUserThrowsInvalidCredentials() {
        when(userService.findLockedById(USER_ID)).thenReturn(Optional.empty());
        assertThrows(InvalidCredentialsException.class, () -> service.changePassword(OLD_PASSWORD, VALID_PASSWORD));

        User deactivated = regularUser();
        deactivated.deactivate();
        when(userService.findLockedById(USER_ID)).thenReturn(Optional.of(deactivated));
        assertThrows(InvalidCredentialsException.class, () -> service.changePassword(OLD_PASSWORD, VALID_PASSWORD));
        verify(invitationService, never()).consume(any());
    }

    private User invitedStartedUser() {
        User user = User.invitedParticipant("Participante", EMAIL, passwordEncoder.encode("segredo-temp"));
        user.beginActivation();
        ReflectionTestUtils.setField(user, "id", USER_ID);
        return user;
    }

    private User regularUser() {
        User user = new User("Pesquisador", EMAIL, passwordEncoder.encode(OLD_PASSWORD), UserRole.RESEARCHER);
        ReflectionTestUtils.setField(user, "id", USER_ID);
        return user;
    }
}
