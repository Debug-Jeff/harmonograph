"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveCurve, shareUrl } from "@/lib/gallery/client";
import { LIMITS, type CurveParams } from "@/lib/gallery/schema";

interface Props {
  getParams: () => CurveParams | null;
  suggestTitle: () => string;
  bottom: number;
}

const NAME_KEY = "harmony.name";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; id: string } | { kind: "error"; message: string };

export function SaveCurve({ getParams, suggestTitle, bottom }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [params, setParams] = useState<CurveParams | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
    }
  }, []);

  const begin = () => {
    const p = getParams();
    if (!p) {
      setStatus({ kind: "error", message: "Nothing to save yet — no two-voice curve on screen." });
      setOpen(true);
      return;
    }
    setParams(p);
    setTitle(suggestTitle());
    setStatus({ kind: "idle" });
    setOpen(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params) return;
    setStatus({ kind: "saving" });
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
    }
    try {
      const curve = await saveCurve({ createdBy: name, title, params });
      setStatus({ kind: "saved", id: curve.id });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <>
      <button className="save-trigger" onClick={begin}>
        Save
      </button>
      {open && (
        <form className="save-plate" style={{ bottom }} onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          {status.kind === "saved" ? (
            <>
              <p className="save-done">Saved to the gallery.</p>
              <div className="save-actions">
                <Link className="play plain" href={`/gallery?c=${status.id}`}>
                  View
                </Link>
                <button
                  type="button"
                  className="play plain"
                  onClick={() => navigator.clipboard?.writeText(shareUrl(status.id)).catch(() => {})}
                >
                  Copy link
                </button>
                <button type="button" className="save-cancel" onClick={() => setOpen(false)}>
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              {params && (
                <>
                  <label className="field">
                    <span>Your name</span>
                    <input ref={nameRef} value={name} maxLength={LIMITS.name} required onChange={(e) => setName(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Title</span>
                    <input value={title} maxLength={LIMITS.title} required onChange={(e) => setTitle(e.target.value)} />
                  </label>
                </>
              )}
              {status.kind === "error" && (
                <p className="save-error" role="alert">
                  {status.message}
                </p>
              )}
              <div className="save-actions">
                {params && (
                  <button type="submit" className="play plain" disabled={status.kind === "saving"}>
                    {status.kind === "saving" ? "Saving…" : "Save"}
                  </button>
                )}
                <button type="button" className="save-cancel" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </>
  );
}
