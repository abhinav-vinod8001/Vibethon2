/** Validate all labels as a unit; a partial or malformed answer is never cached. */
export function validateTranslationMessages(
  value: unknown,
  manifest: Record<string, string>,
): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  const ids = Object.keys(manifest);
  if (entries.length !== ids.length) return null;
  const result: Record<string, string> = {};
  for (const [id, text] of entries) {
    if (!Object.hasOwn(manifest, id) || typeof text !== "string") return null;
    const translated = text.trim();
    const source = manifest[id];
    if (
      !translated ||
      translated.length > Math.min(3000, Math.max(500, source.length * 5)) ||
      placeholders(source) !== placeholders(translated)
    )
      return null;
    result[source] = translated;
  }
  return result;
}

function placeholders(value: string) {
  return (value.match(/\{[A-Za-z_]\w*\}/g) || []).sort().join("|");
}

export function validatePublishedMessages(
  value: unknown,
  manifest: Record<string, string>,
): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const messages = value as Record<string, unknown>;
  if (Object.keys(messages).length !== Object.keys(manifest).length)
    return null;
  const byId: Record<string, unknown> = {};
  for (const [id, source] of Object.entries(manifest)) {
    if (!Object.hasOwn(messages, source)) return null;
    byId[id] = messages[source];
  }
  return validateTranslationMessages(byId, manifest);
}
