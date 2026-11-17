ALTER TABLE simulated_consents
    ADD COLUMN recorded_by_user_id BIGINT REFERENCES users (id);

UPDATE simulated_consents AS sc
SET recorded_by_user_id = c.user_id
FROM candidates AS c
WHERE c.id = sc.candidate_id
  AND sc.recorded_by_user_id IS NULL;
