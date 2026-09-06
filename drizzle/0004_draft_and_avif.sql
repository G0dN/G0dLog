-- Keep the public article fields stable while autosave stores unpublished edits.
ALTER TABLE articles ADD COLUMN draft_title text;
ALTER TABLE articles ADD COLUMN draft_body_markdown text;

-- AVIF is an additional public derivative; GIF uploads may leave this null.
ALTER TABLE media ADD COLUMN avif_key text;
CREATE UNIQUE INDEX IF NOT EXISTS media_avif_key_unique ON media (avif_key);
