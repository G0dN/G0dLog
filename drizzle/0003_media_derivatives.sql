ALTER TABLE media ADD COLUMN display_key text;
UPDATE media SET display_key = storage_key WHERE display_key IS NULL OR display_key = '';
CREATE UNIQUE INDEX IF NOT EXISTS media_display_key_unique ON media (display_key);
