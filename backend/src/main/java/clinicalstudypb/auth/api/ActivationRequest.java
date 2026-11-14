package clinicalstudypb.auth.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** E-mail e código informados no primeiro acesso pelo aplicativo. */
public record ActivationRequest(@NotBlank @Email @Size(max = 255) String email,
                                @NotBlank @Size(max = 32) String activationCode) {
}
