-- RF16 (T22.1): dados da retirada do participante.
-- A situação ACTIVE/WITHDRAWN já existe desde a V12; a retirada grava motivo, instante,
-- autor e a quantidade de visitas futuras canceladas na mesma operação.
ALTER TABLE participants
    ADD COLUMN withdrawal_reason VARCHAR(500),
    ADD COLUMN withdrawn_at TIMESTAMPTZ,
    ADD COLUMN withdrawn_by_user_id BIGINT REFERENCES users (id),
    ADD COLUMN withdrawal_cancelled_visit_count INTEGER;

-- Participante ativo não tem dados de retirada; participante retirado tem todos.
ALTER TABLE participants ADD CONSTRAINT ck_participants_withdrawal_fields CHECK (
    (status = 'ACTIVE'
        AND withdrawal_reason IS NULL
        AND withdrawn_at IS NULL
        AND withdrawn_by_user_id IS NULL
        AND withdrawal_cancelled_visit_count IS NULL)
    OR (status = 'WITHDRAWN'
        AND withdrawal_reason IS NOT NULL
        AND btrim(withdrawal_reason) <> ''
        AND withdrawn_at IS NOT NULL
        AND withdrawn_by_user_id IS NOT NULL
        AND withdrawal_cancelled_visit_count IS NOT NULL
        AND withdrawal_cancelled_visit_count >= 0)
);
