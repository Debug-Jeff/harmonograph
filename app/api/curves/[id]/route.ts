import { jsonError, storageError } from "@/lib/gallery/server";
import { getStore } from "@/lib/gallery/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{6,20}$/.test(id)) return jsonError(404, "Not found.");
  try {
    const curve = await getStore().get(id);
    return curve ? Response.json({ curve }) : jsonError(404, "Not found.");
  } catch (err) {
    return storageError(err);
  }
}
