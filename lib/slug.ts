export function readableSlug(value: string, fallback = "item") {
  const normalized = value.normalize("NFKC").toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return normalized || fallback;
}

export function slugWithId(value: string, id: string) {
  return `${readableSlug(value, "item")}-${id.slice(0, 8).toLowerCase()}`;
}
