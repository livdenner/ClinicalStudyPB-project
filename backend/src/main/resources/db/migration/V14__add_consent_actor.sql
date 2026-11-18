-- Na Release 1 o consentimento era registrado pelo coordenador sem coluna de autoria.
-- Decisões anteriores à Sprint 3 permanecem com recorded_by_user_id = NULL em vez de
-- receberem autoria fictícia; novos registros via API gravam o participante autenticado.
ALTER TABLE simulated_consents
    ADD COLUMN recorded_by_user_id BIGINT REFERENCES users (id);
