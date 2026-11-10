CREATE TABLE eligibility_evaluations (
    candidate_id BIGINT PRIMARY KEY REFERENCES candidates (id) ON DELETE CASCADE,
    evaluated_by BIGINT NOT NULL REFERENCES users (id),
    evaluated_at TIMESTAMPTZ NOT NULL
);
