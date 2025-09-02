CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    username TEXT,
    balance REAL DEFAULT 0,
    referred_by BIGINT,
    joined_channels BOOLEAN DEFAULT false,
    last_bonus_claim TIMESTAMPTZ
);

CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    referrer_id BIGINT REFERENCES users(id),
    referred_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION increment_balance(amount real, user_id bigint)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET balance = balance + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE users ADD COLUMN withdrawal_request_amount REAL;
