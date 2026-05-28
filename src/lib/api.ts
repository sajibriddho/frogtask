/**
 * Safe JSON parser for API responses.
 * Prevents "JSON.parse: unexpected character" when server returns HTML (e.g. 404).
 */

export async function parseJsonSafe<T = { success?: boolean; data?: unknown; error?: string }>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text?.trim()) {
    return { success: false, data: [], error: "Empty response" } as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return { success: false, data: [], error: "Invalid response from server" } as T;
  }
}
