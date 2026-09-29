import { validateNewCurve } from "@/lib/gallery/schema";
import { MAX_BODY_BYTES, SAVE_LIMIT, clientHash, jsonError, storageError } from "@/lib/gallery/server";
import { getStore } from "@/lib/gallery/store";

const PAGE = 60;

export async function GET() {
  try {
    return Response.json({ curves: await getStore().list(PAGE) });
  } catch (err) {
    return storageError(err);
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return jsonError(413, "Request too large.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "Body must be JSON.");
  }
  const parsed = validateNewCurve(body);
  if (!parsed.ok) return jsonError(400, parsed.error);

  try {
    const store = getStore();
    const who = clientHash(req);
    const recent = await store.countRecent(who, new Date(Date.now() - SAVE_LIMIT.windowMs));
    if (recent >= SAVE_LIMIT.max) {
      return jsonError(429, "Too many saves — try again in a few minutes.", {
        "Retry-After": String(Math.ceil(SAVE_LIMIT.windowMs / 1000)),
      });
    }
    const curve = await store.create(parsed.value, who);
    return Response.json({ curve }, { status: 201 });
  } catch (err) {
    return storageError(err);
  }
}
