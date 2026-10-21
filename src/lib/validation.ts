/**
 * Shared validation helpers for SlideQuill API routes.
 */

/**
 * Validates whether a value is a valid 24-character hexadecimal MongoDB ObjectId string or Types.ObjectId.
 */
export function isValidObjectId(id: unknown): boolean {
  if (!id) return false;
  if (typeof id === "string") {
    return /^[0-9a-fA-F]{24}$/.test(id.trim());
  }
  if (typeof id === "object" && id !== null) {
    try {
      const str = String(id);
      return /^[0-9a-fA-F]{24}$/.test(str);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Validates a slide ID.
 * In SlideQuill, slide IDs can be MongoDB ObjectIds (24-hex), standard UUIDs (36-char),
 * or slug identifiers (e.g. slide-1, slide-stats-1).
 */
export function isValidSlideId(id: unknown): boolean {
  if (!id) return false;
  if (typeof id !== "string") {
    if (typeof id === "object" && id !== null) {
      try {
        const str = String(id);
        return /^[0-9a-fA-F]{24}$/.test(str);
      } catch {
        return false;
      }
    }
    return false;
  }
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 128) return false;
  // Valid formats: 24-char hex, standard UUID, or safe alphanumeric slug
  return (
    /^[0-9a-fA-F]{24}$/.test(trimmed) ||
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(trimmed) ||
    /^[\w-]+$/.test(trimmed)
  );
}
