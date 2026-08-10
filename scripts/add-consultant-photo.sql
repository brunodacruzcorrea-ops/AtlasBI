-- Safe to run multiple times against the Railway PostgreSQL database.
ALTER TABLE consultants
ADD COLUMN IF NOT EXISTS photo text;