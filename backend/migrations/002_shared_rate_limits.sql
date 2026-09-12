CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
  bucket_key char(64) PRIMARY KEY,
  hits integer NOT NULL CHECK (hits > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS api_rate_limit_expiry_idx ON api_rate_limit_buckets(expires_at);
