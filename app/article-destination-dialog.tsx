"use client";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type Destination = { id: string; title: string };
export default function ArticleDestinationDialog({ mode, columns, initialColumnId = "", published = false, onClose, onSubmit }: { mode: "create" | "move"; columns: Destination[]; initialColumnId?: string; published?: boolean; onClose: () => void; onSubmit: (columnId: string, title: string) => Promise<void> }) {
  const [columnId, setColumnId] = useState(initialColumnId);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  useEffect(() => { const element = dialog.current; element?.showModal(); element?.querySelector<HTMLInputElement>('input')?.focus(); return () => element?.close(); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || !columnId) return;
    submitting.current = true; setBusy(true); setError("");
    try { await onSubmit(columnId, title); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "操作失败，请重试。"); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <dialog className="destination-dialog" ref={dialog} aria-labelledby="destination-title" onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}>
    <h2 id="destination-title">{mode === "create" ? "新建文章" : "移动文章"}</h2>
    <p className="muted">{mode === "create" ? "选择专栏，让新的想法有处安放。" : published ? "文章将从原专栏移至目标专栏，公开链接保持不变。" : "未保存的修改会先保存，文章将排在目标专栏末尾。"}</p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {mode === "create" && <label>文章标题<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="未命名文章（可稍后修改）" /></label>}
      <label>搜索专栏<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入专栏名称" /></label>
      <p className="destination-selection">{mode === "create" ? "所属专栏" : "目标专栏"}：{columns.find((column) => column.id === columnId)?.title || "请选择专栏"}</p>
      <div className="destination-options" role="radiogroup" aria-label="所属专栏">{columns.filter((column) => column.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map((column) => <label key={column.id}><input type="radio" name="destination" value={column.id} checked={columnId === column.id} onChange={() => setColumnId(column.id)} />{column.title}</label>)}{!columns.some((column) => column.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && <p className="muted">{columns.length ? "没有匹配的专栏。" : "暂无可用专栏，请先创建专栏或联系管理员。"}</p>}</div>
      {error && <p className="destination-error" role="alert">{error}</p>}
      <div className="destination-actions"><button type="button" className="text-button" onClick={onClose}>取消</button><button className="button button-dark" disabled={!columnId}>{busy ? "正在处理…" : mode === "create" ? "创建草稿" : "确认移动"}</button></div>
    </fieldset></form>
  </dialog>;
}
