"use client";

/* Local drafts are restored after hydration, when browser storage is available. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";

type Info = { title: string; description: string };

export function ColumnInfoForm({ column, onSaved, onDelete }: {
  column: Info & { id: string };
  onSaved: (info: Info & { slug: string; updatedAt: string }) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Info>({ title: column.title, description: column.description });
  const [status, setStatus] = useState("已保存");
  const pending = useRef<Info | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onSaved);
  const key = "g0dlog-column-draft-" + column.id;
  useEffect(() => { callback.current = onSaved; }, [onSaved]);

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (busy.current || !pending.current) return;
    busy.current = true;
    try {
      while (pending.current) {
        const value: Info = pending.current;
        if (!value.title.trim()) {
          if (mounted.current) setStatus("标题不能为空，尚未保存");
          return;
        }
        if (mounted.current) setStatus("正在保存…");
        const response = await fetch("/api/columns/" + column.id, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value), keepalive: true,
        });
        if (!response.ok) throw new Error("保存失败");
        const data = await response.json();
        callback.current(data.column);
        if (pending.current === value) {
          pending.current = null;
          try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
          if (mounted.current) setStatus("已保存");
        }
      }
    } catch {
      if (mounted.current) setStatus("保存失败，修改已保留，请重试");
    } finally { busy.current = false; }
  };
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; });
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && typeof saved.title === "string" && typeof saved.description === "string") {
        pending.current = saved;
        setDraft(saved);
        setStatus("待保存");
        timer.current = setTimeout(() => void flushRef.current(), 1000);
      }
    } catch { /* Ignore malformed local drafts. */ }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current || busy.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
      void flushRef.current();
    };
  }, [key]);

  const change = (value: Info) => {
    setDraft(value);
    pending.current = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Saving still works without local storage. */ }
    setStatus("待保存");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), 1000);
  };
  return <div className="form-block">
    <label>标题<input aria-label="标题" value={draft.title} onChange={(event) => change({ ...draft, title: event.target.value })} onBlur={() => void flush()} /></label>
    <label>简介<textarea aria-label="简介" value={draft.description} onChange={(event) => change({ ...draft, description: event.target.value })} onBlur={() => void flush()} rows={4} /></label>
    <div className="manager-actions">
      <span role="status" aria-live="polite">{status}</span>
      {status.startsWith("保存失败") && <button className="text-button" onClick={() => void flush()}>重试</button>}
      <button className="text-button danger" disabled={status !== "已保存"} onClick={onDelete}>删除专栏</button>
    </div>
  </div>;
}
