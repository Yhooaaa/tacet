import "server-only";

export async function readJson<T>(request: Request, maxBytes = 16 * 1024): Promise<T | null> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const unauthorized = () => Response.json({ error: "Sign in to continue." }, { status: 401 });
