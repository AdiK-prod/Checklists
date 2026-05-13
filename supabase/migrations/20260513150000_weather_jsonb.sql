-- Migrate trips.weather from text to jsonb.
-- Existing plain-text values are wrapped as { "raw": "<original text>" }
-- so the client can detect them and display as-is for backward compatibility.
-- New structured values will have shape { "tempMin": number, "tempMax": number, "condition": string }

ALTER TABLE trips
  ALTER COLUMN weather TYPE jsonb
  USING CASE
    WHEN weather IS NULL THEN NULL
    WHEN weather::text ~ '^[\{\[]' THEN weather::jsonb
    ELSE jsonb_build_object('raw', weather::text)
  END;
