-- Add index on password_reset_tokens.token for O(log n) lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
ON password_reset_tokens(token);
