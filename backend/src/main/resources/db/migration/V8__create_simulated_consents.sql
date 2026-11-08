CREATE TABLE simulated_consents (
    candidate_id BIGINT PRIMARY KEY REFERENCES candidates (id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    locked_after_inclusion BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_simulated_consent_status CHECK (status IN ('GRANTED', 'DECLINED'))
);
