"use client";

/* The editor deliberately synchronizes local drafts and selected records in effects. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent, ElementType, FormEvent, ReactNode } from "react";
import hljs from "highlight.js/lib/common";
import katex from "katex";
import studioStyles from "./studio.module.css";
import ArticleDestinationDialog from "./article-destination-dialog";
import { ColumnInfoForm } from "./column-info-form";
import { cloudflareEmailCode, PROJECT_URL } from "../lib/site-config";

const SITE_NAME = "G0dLog";
type ApiColumn = { id: string; slug: string; title: string; description: string; creatorId: string; creatorName?: string; articleCount?: number; updatedAt?: string; latestPublishedAt?: string | null; deletedAt?: string | null };
type ApiArticle = { id: string; slug: string; columnId: string; columnSlug?: string; columnTitle?: string; authorId: string; authorSlug?: string; authorName?: string; title: string; bodyMarkdown: string; status: "draft" | "published" | "deleted"; firstPublishedAt?: string | null; lastPublishedAt?: string | null; sortOrder?: number; version?: number; matchType?: "title" | "body" | "author" | "column" | "none"; snippet?: string };
type PublicAuthor = { id: string; slug: string; displayName: string; avatarUrl?: string | null; signature?: string | null };
type ApiVersion = { version: number; title: string; bodyMarkdown: string; kind: "autosave" | "publish" | "delete"; createdAt: string };
type SessionUser = { id: string; username: string; slug?: string; displayName: string; avatarUrl?: string | null; signature?: string | null; role: "owner" | "author"; mustChangePassword?: boolean };
type Block = { type: "heading"; text: string; id: string; level: number } | { type: "paragraph"; text: string } | { type: "quote"; text: string } | { type: "code"; language: string; text: string } | { type: "math"; text: string } | { type: "list"; items: string[]; ordered: boolean } | { type: "image"; src: string; alt: string } | { type: "table"; headers: string[]; rows: string[][] };
type View = "home" | "reader" | "studio";

const displayDate = (value?: string | null) => { if (!value) return "—"; const parts = value.slice(0, 10).split("-"); return parts[0] + " 年 " + parts[1] + " 月 " + parts[2] + " 日"; };
const articlePath = (article: Pick<ApiArticle, "id" | "slug">) => "/articles/" + encodeURIComponent(article.id) + "/" + encodeURIComponent(article.slug);
const columnPath = (column: Pick<ApiColumn, "id" | "slug">) => "/columns/" + encodeURIComponent(column.id) + "/" + encodeURIComponent(column.slug);
const authorPath = (id: string, slug?: string) => slug ? "/authors/" + encodeURIComponent(id) + "/" + encodeURIComponent(slug) : "/authors/" + encodeURIComponent(id);
const excerpt = (body: string) => body.replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g, " ").replace(/[#>*_()\x60~-]/g, " ").replace(/\[/g, " ").replace(/\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
const searchRank = (article: ApiArticle, term: string) => { const normalized = term.toLocaleLowerCase(); if (article.title.toLocaleLowerCase().includes(normalized)) return 0; if (article.bodyMarkdown.toLocaleLowerCase().includes(normalized)) return 1; if ((article.authorName || "").toLocaleLowerCase().includes(normalized)) return 2; return 3; };
const searchExcerpt = (body: string, term: string) => { const plain = excerpt(body); const position = body.toLocaleLowerCase().indexOf(term.toLocaleLowerCase()); return position > 80 ? "…" + body.slice(Math.max(0, position - 60), position + 120).replace(/\s+/g, " ") : plain; };
const headingId = (text: string, index: number) => text.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section-" + (index + 1);
const safeUrl = (value: string) => { const candidate = value.trim(); if ((candidate.startsWith("/") && !candidate.startsWith("//")) || candidate.startsWith("#")) return candidate; try { const url = new URL(candidate); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null; } catch { return null; } };
const highlightParts = (text: string, query: string) => { const term = query.trim(); if (!term) return [text]; const escaped = term.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\[/g, "\\[").replace(/\]/g, "\\]"); return text.split(new RegExp("(" + escaped + ")", "ig")); };

export const parseMarkdown = (markdown: string): Block[] => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n"); const blocks: Block[] = []; let index = 0;
  while (index < lines.length) {
    const line = lines[index]; if (!line.trim()) { index += 1; continue; }
    if (/^\s*\$\$\s*$/.test(line)) { const formula: string[] = []; index += 1; while (index < lines.length && !/^\s*\$\$\s*$/.test(lines[index])) formula.push(lines[index++]); if (index < lines.length) index += 1; blocks.push({ type: "math", text: formula.join("\n") }); continue; }
    const fence = line.match(/^\s*\x60\x60\x60\s*([\w-]*)\s*$/);
    if (fence) { const code: string[] = []; index += 1; while (index < lines.length && !/^\s*\x60\x60\x60\s*$/.test(lines[index])) code.push(lines[index++]); if (index < lines.length) index += 1; blocks.push({ type: "code", language: fence[1] || "text", text: code.join("\n") }); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { blocks.push({ type: "heading", text: heading[2].trim(), level: heading[1].length, id: headingId(heading[2], blocks.length) }); index += 1; continue; }
    const image = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (image) { const src = safeUrl(image[2]); if (src) blocks.push({ type: "image", alt: image[1], src }); index += 1; continue; }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) { const cells = (value: string) => value.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()); const headers = cells(line); const rows: string[][] = []; index += 2; while (index < lines.length && lines[index].includes("|") && lines[index].trim()) rows.push(cells(lines[index++])); blocks.push({ type: "table", headers, rows }); continue; }
    if (/^>\s?/.test(line)) { const quote: string[] = []; while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, "")); blocks.push({ type: "quote", text: quote.join("\n") }); continue; }
    const list = line.match(/^\s*([-*+]\s+|\d+[.]\s+)(.+)$/);
    if (list) { const ordered = /^\d/.test(list[1]); const items: string[] = []; while (index < lines.length) { const next = lines[index].match(/^\s*([-*+]\s+|\d+[.]\s+)(.+)$/); if (!next || /^\d/.test(next[1]) !== ordered) break; items.push(next[2]); index += 1; } blocks.push({ type: "list", items, ordered }); continue; }
    const paragraph: string[] = [line.trim()]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+|^\s*\x60\x60\x60|^\s*\$\$\s*$|^>\s?|^\s*([-*+]\s+|\d+[.]\s+)|^!\[/.test(lines[index])) { if (lines[index].includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) break; paragraph.push(lines[index++].trim()); }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
};

function InlineText({ text }: { text: string }) {
  const tokens = text.split(/(\x60[^\x60]+\x60|\*\*[^*]+\*\*|\*[^*]+\*|\$\$[^$]+\$\$|\$[^$]+\$|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return <>{tokens.map((token, index) => { if (token.startsWith("\x60") && token.endsWith("\x60")) return <code key={index}>{token.slice(1, -1)}</code>; if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>; if (token.startsWith("*") && token.endsWith("*")) return <em key={index}>{token.slice(1, -1)}</em>; if (token.startsWith("$$") && token.endsWith("$$")) return <MathContent key={index} expression={token.slice(2, -2)} />; if (token.startsWith("$") && token.endsWith("$")) return <MathContent key={index} expression={token.slice(1, -1)} />; const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/); if (link) { const href = safeUrl(link[2]); return href ? <a key={index} href={href} rel={href.startsWith("http") ? "nofollow noopener noreferrer" : undefined}>{link[1]}</a> : <span key={index}>{link[1]}</span>; } return <span key={index}>{token}</span>; })}</>;
}

function HighlightedCode({ text, language }: { text: string; language: string }) {
  const highlighted = hljs.getLanguage(language) ? hljs.highlight(text, { language, ignoreIllegals: true }).value : hljs.highlightAuto(text).value;
  return <pre className={"code-block language-" + language}><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>;
}

function MathContent({ expression, displayMode = false }: { expression: string; displayMode?: boolean }) {
  const html = katex.renderToString(expression, { displayMode, throwOnError: false, trust: false, strict: "ignore" });
  return <span className={displayMode ? "math-block" : "math-inline"} role="math" dangerouslySetInnerHTML={{ __html: html }} />;
}

function ArticleBody({ markdown }: { markdown: string }) {
  return <div className="article-body">{parseMarkdown(markdown).map((block, index) => { if (block.type === "heading") { const Heading = ("h" + Math.min(block.level, 6)) as ElementType; return <Heading id={block.id} key={index}><InlineText text={block.text} /></Heading>; } if (block.type === "code") return <HighlightedCode key={index} language={block.language} text={block.text} />; if (block.type === "math") return <MathContent key={index} expression={block.text} displayMode />; if (block.type === "quote") return <blockquote key={index}>{block.text.split("\n").map((line) => <p key={line}><InlineText text={line} /></p>)}</blockquote>; if (block.type === "list") { const List = block.ordered ? "ol" : "ul"; return <List key={index}>{block.items.map((item) => <li key={item}><InlineText text={item} /></li>)}</List>; } if (block.type === "image") return <figure key={index}><img src={block.src} alt={block.alt} loading="lazy" /><figcaption>{block.alt}</figcaption></figure>; if (block.type === "table") return <div className="table-scroll" key={index}><table><thead><tr>{block.headers.map((header) => <th key={header}><InlineText text={header} /></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><InlineText text={cell} /></td>)}</tr>)}</tbody></table></div>; return <p key={index}><InlineText text={block.text} /></p>; })}</div>;
}
function ContactLink() { const code = cloudflareEmailCode(); return <a className="__cf_email__ contact-email" data-cfemail={code} href={"/cdn-cgi/l/email-protection#" + code}>联系站主</a>; }

export default function Home({ initialView = "home", initialArticleId, initialColumnId, initialAuthorId, initialArticleSlug, initialColumnSlug, initialAuthorSlug, initialArticles, initialColumns, initialAuthor }: { initialView?: View; initialArticleId?: string; initialArticleSlug?: string; initialColumnId?: string; initialColumnSlug?: string; initialAuthorId?: string; initialAuthorSlug?: string; initialArticles?: ApiArticle[]; initialColumns?: ApiColumn[]; initialAuthor?: PublicAuthor }) {
  const initialPublicSlug = initialArticleSlug || initialColumnSlug || initialAuthorSlug;
  void initialPublicSlug;
  const [view, setView] = useState<View>(initialView); const [columns, setColumns] = useState<ApiColumn[]>(initialColumns || []); const [articles, setArticles] = useState<ApiArticle[]>(initialArticles || []); const [publicAuthor, setPublicAuthor] = useState<PublicAuthor | null>(initialAuthor || null); const [selectedArticleId, setSelectedArticleId] = useState(initialArticleId || ""); const [searchQuery, setSearchQuery] = useState(""); const [columnQuery, setColumnQuery] = useState(""); const [activeColumnId, setActiveColumnId] = useState(initialColumnId || ""); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(initialView !== "studio" && !initialArticles && !initialColumns);
  const refreshPublic = useCallback(async () => { setLoading(true); try { const results = await Promise.all([fetch("/api/columns"), fetch("/api/articles")]); if (!results[0].ok || !results[1].ok) throw new Error("public"); const columnData = await results[0].json() as { columns: ApiColumn[] }; const articleData = await results[1].json() as { articles: ApiArticle[] }; setColumns(columnData.columns); setArticles(articleData.articles); setSelectedArticleId((value) => value || articleData.articles[0]?.id || ""); } catch { setNotice("公开内容暂时无法加载"); } finally { setLoading(false); } }, []);
  useEffect(() => { if (initialView !== "studio") void refreshPublic(); }, [initialView, refreshPublic]);
  useEffect(() => { if (!initialAuthorId) return; let cancelled = false; void fetch("/api/authors/" + encodeURIComponent(initialAuthorId)).then(async (response) => { if (!response.ok) throw new Error("author"); return await response.json() as { author: PublicAuthor }; }).then((data) => { if (!cancelled) setPublicAuthor(data.author); }).catch(() => { if (!cancelled) setNotice("作者资料暂时无法加载"); }); return () => { cancelled = true; }; }, [initialAuthorId]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 5000); return () => window.clearTimeout(timer); }, [notice]);
  const selectedArticle = articles.find((article) => article.id === selectedArticleId) || null; const selectedColumn = columns.find((column) => column.id === (selectedArticle?.columnId || activeColumnId)) || null;
  const openReader = (article: ApiArticle) => { setSelectedArticleId(article.id); setView("reader"); setColumnQuery(""); window.history.pushState({}, "", articlePath(article)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const [columnScrollRequest, setColumnScrollRequest] = useState(0);
  useEffect(() => {
    if (!columnScrollRequest || loading || searchQuery) return;
    const list = document.getElementById("public-article-list");
    list?.focus({ preventScroll: true });
    list?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }, [columnScrollRequest, loading, searchQuery]);
  const openColumn = (column: ApiColumn) => { setActiveColumnId(column.id); setSearchQuery(""); setColumnScrollRequest((value) => value + 1); window.history.pushState({}, "", columnPath(column)); };
  return <main className="site-shell">{view === "home" && <SiteHeader searchQuery={searchQuery} onSearch={setSearchQuery} onHome={() => { setSearchQuery(""); setActiveColumnId(""); window.history.pushState({}, "", "/"); }} onStudio={() => setView("studio")} />}{view === "home" && <HomeView columns={columns} articles={articles} loading={loading} searchQuery={searchQuery} onSearch={setSearchQuery} activeColumnId={activeColumnId} onSelectColumn={openColumn} onOpenArticle={openReader} authorId={initialAuthorId} author={publicAuthor} />}{view === "reader" && (selectedArticle && selectedColumn ? <ReaderView article={selectedArticle} column={selectedColumn} articles={articles} columnQuery={columnQuery} setColumnQuery={setColumnQuery} onBack={() => { setView("home"); window.history.pushState({}, "", "/"); }} onOpenArticle={openReader} /> : <EmptyState text={loading ? "正在加载文章…" : "文章不存在或已停止公开。"} />)}{view === "studio" && <StudioView onBack={() => { setView("home"); void refreshPublic(); }} onNotice={setNotice} />}{notice && <div className="toast" role="status">{notice}</div>}</main>;
}

function SiteHeader({ searchQuery, onSearch, onHome, onStudio }: { searchQuery: string; onSearch: (value: string) => void; onHome: () => void; onStudio: () => void }) { return <header className="site-header"><button className="wordmark" onClick={onHome} aria-label={"返回" + SITE_NAME + "首页"}><strong>{SITE_NAME}</strong></button><div className="header-actions"><label className="header-search"><span aria-hidden="true">⌕</span><input value={searchQuery} onChange={(event) => onSearch(event.target.value)} placeholder="搜索文章、专栏或作者" aria-label="搜索文章、专栏或作者" /></label><button className="studio-link" onClick={onStudio}>后台</button></div></header>; }

function HomeView({ columns, articles, loading, searchQuery, onSearch, activeColumnId, onSelectColumn, onOpenArticle, authorId, author }: { columns: ApiColumn[]; articles: ApiArticle[]; loading: boolean; searchQuery: string; onSearch: (value: string) => void; activeColumnId: string; onSelectColumn: (column: ApiColumn) => void; onOpenArticle: (article: ApiArticle) => void; authorId?: string; author: PublicAuthor | null }) {
  const visibleColumns = authorId ? columns.filter((column) => column.creatorId === authorId) : columns; const visibleArticles = articles.filter((article) => article.status === "published" && (!activeColumnId || article.columnId === activeColumnId) && (!authorId || article.authorId === authorId)).sort((a, b) => activeColumnId ? (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.firstPublishedAt ?? "").localeCompare(String(b.firstPublishedAt ?? "")) : String(b.firstPublishedAt ?? "").localeCompare(String(a.firstPublishedAt ?? ""))); const term = searchQuery.trim().toLowerCase(); const results = term ? { articles: visibleArticles.filter((article) => [article.title, article.bodyMarkdown, article.authorName, article.columnTitle].join(" ").toLowerCase().includes(term)).sort((a, b) => searchRank(a, term) - searchRank(b, term) || String(b.firstPublishedAt ?? "").localeCompare(String(a.firstPublishedAt ?? ""))), columns: visibleColumns.filter((column) => [column.title, column.description, column.creatorName].join(" ").toLowerCase().includes(term)) } : null;
  return <><section className={"home-intro content-width " + (author ? "author-intro" : "")}><div>{author && <div className="author-profile">{author.avatarUrl ? <img src={author.avatarUrl} alt="" className="author-avatar" /> : <div className="author-avatar author-avatar-fallback" aria-hidden="true">{author.displayName.slice(0, 1)}</div>}<div><p className="eyebrow">{SITE_NAME} · 作者</p><h1>{author.displayName}</h1>{author.signature && <p>{author.signature}</p>}</div></div>}{!author && <><p className="eyebrow">{SITE_NAME}</p><h1>{authorId ? "作者公开页" : "公开写作与教程"}</h1><p>站主与受邀作者的公开写作空间。<span className="intro-contact"> · <ContactLink /> · <a href={PROJECT_URL} target="_blank" rel="noreferrer">GitHub 项目</a></span></p></>}</div><div className="home-count">{visibleColumns.length} 个专栏 · {visibleArticles.length} 篇文章</div></section>{loading ? <EmptyState text="正在加载公开内容…" /> : results ? <section className="search-results content-width"><div className="section-heading"><h2>搜索结果</h2><button className="text-button" onClick={() => onSearch("")}>清除搜索</button></div><p className="search-summary">“{searchQuery}”</p><div className="search-groups"><SearchGroup label="文章" count={results.articles.length}>{results.articles.map((article) => <button className="search-result" key={article.id} onClick={() => onOpenArticle(article)}><span><HighlightText text={article.columnTitle || ""} query={searchQuery} /></span><strong><HighlightText text={article.title} query={searchQuery} /></strong><small>{article.authorName} · {displayDate(article.firstPublishedAt)}</small><p><HighlightText text={searchExcerpt(article.bodyMarkdown, searchQuery)} query={searchQuery} /></p></button>)}</SearchGroup><SearchGroup label="专栏" count={results.columns.length}>{results.columns.map((column) => <button className="search-result" key={column.id} onClick={() => onSelectColumn(column)}><strong><HighlightText text={column.title} query={searchQuery} /></strong><p><HighlightText text={column.description} query={searchQuery} /></p></button>)}</SearchGroup></div></section> : <><section className="content-width latest-section"><div className="section-heading"><h2>专栏</h2></div><div className="column-grid">{visibleColumns.map((column, index) => <button className={"column-card " + (activeColumnId === column.id ? "selected" : "")} key={column.id} aria-pressed={activeColumnId === column.id} title={column.description || column.title} onClick={() => onSelectColumn(column)}><span className="card-index">{String(index + 1).padStart(2, "0")}</span><span><strong>{column.title}</strong><small>{column.description}</small></span><em>{column.creatorName} · {column.articleCount || 0} 篇</em></button>)}</div>{!visibleColumns.length && <EmptyState text="还没有公开专栏。" />}</section><section id="public-article-list" tabIndex={-1} aria-label="文章列表" className="content-width article-feed"><div className="feed-heading"><h2>{activeColumnId ? (columns.find((column) => column.id === activeColumnId)?.title || "专栏") : "最近文章"}</h2><span>{visibleArticles.length} 篇</span></div><div className="article-list">{visibleArticles.map((article, index) => <button className="article-row" key={article.id} onClick={() => onOpenArticle(article)}><span className="article-number">{String(index + 1).padStart(2, "0")}</span><span className="article-main"><small>{article.columnTitle}</small><strong>{article.title}</strong><span>{excerpt(article.bodyMarkdown)}</span></span><span className="article-details"><span>{article.authorName}</span><span>{displayDate(article.firstPublishedAt)}</span></span></button>)}</div>{!visibleArticles.length && <EmptyState text="这个范围还没有公开文章。" />}</section></>}</>;
}
function SearchGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) { return <div className="search-group"><div className="search-group-heading"><strong>{label}</strong><span>{count}</span></div>{count ? children : <p className="muted">没有匹配的{label}</p>}</div>; }
function HighlightText({ text, query }: { text: string; query: string }) { return <>{highlightParts(text, query).map((part, index) => part.toLocaleLowerCase() === query.trim().toLocaleLowerCase() ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>)}</>; }

function ReaderView({ article, column, articles, columnQuery, setColumnQuery, onBack, onOpenArticle }: { article: ApiArticle; column: ApiColumn; articles: ApiArticle[]; columnQuery: string; setColumnQuery: (value: string) => void; onBack: () => void; onOpenArticle: (article: ApiArticle) => void }) {
  const [tocOpen, setTocOpen] = useState(false); const columnArticles = articles.filter((item) => item.columnId === column.id && item.status === "published").sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.firstPublishedAt ?? "").localeCompare(String(b.firstPublishedAt ?? ""))); const query = columnQuery.trim().toLowerCase(); const shownArticles = query ? columnArticles.filter((item) => [item.title, item.bodyMarkdown, item.authorName].join(" ").toLowerCase().includes(query)) : columnArticles; const headings = parseMarkdown(article.bodyMarkdown).filter((block): block is Extract<Block, { type: "heading" }> => block.type === "heading");
  return <div className="reader-page"><header className="reader-toolbar"><button className="back-link" onClick={onBack}>← {SITE_NAME}</button><label className="column-search"><span aria-hidden="true">⌕</span><input value={columnQuery} onChange={(event) => setColumnQuery(event.target.value)} placeholder="搜索当前专栏" aria-label="在本专栏中搜索" /></label></header><div className="reader-layout"><aside className={"reader-sidebar " + (tocOpen ? "open" : "")}><div className="sidebar-top"><span>文章目录</span><button onClick={() => setTocOpen(false)} aria-label="关闭目录">×</button></div><div className="sidebar-column">{column.title}<small>{columnArticles.length} 篇</small></div>{shownArticles.map((item, index) => <button className={"reader-article-link " + (item.id === article.id ? "current" : "")} key={item.id} onClick={() => { onOpenArticle(item); setTocOpen(false); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong></button>)}{!shownArticles.length && <p className="muted">没有匹配文章</p>}</aside><div className="reader-main"><div className="reader-mobile-bar"><button onClick={() => setTocOpen(true)}>☰ 文章目录</button><button onClick={onBack}>返回首页</button></div><article className="reading-column"><div className="reading-meta"><span>{column.title}</span><span>首次发布于 {displayDate(article.firstPublishedAt)}</span><span>最后更新于 {displayDate(article.lastPublishedAt)}</span></div><h1>{article.title}</h1><p className="reading-byline"><a href={authorPath(article.authorId, article.authorSlug)}>{article.authorName}</a></p><ArticleBody markdown={article.bodyMarkdown} /></article><aside className="reading-toc"><span>目录</span>{headings.map((heading) => <a href={"#" + heading.id} key={heading.id}>{heading.text}</a>)}</aside></div></div></div>;
}

function StudioView({ onBack, onNotice }: { onBack: () => void; onNotice: (notice: string) => void }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [columns, setColumns] = useState<ApiColumn[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [deletedColumns, setDeletedColumns] = useState<ApiColumn[]>([]);
  const [deletedArticles, setDeletedArticles] = useState<ApiArticle[]>([]);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [panel, setPanel] = useState<"articles" | "columns" | "recovery" | "members" | "profile">("articles");
  const [selectedColumnId, setSelectedColumnId] = useState("");
  const [articleColumnFilter, setArticleColumnFilter] = useState("");
  const [articleStatusFilter, setArticleStatusFilter] = useState("all");
  const [createDestination, setCreateDestination] = useState<string | null>(null);
  const [focusArticleId, setFocusArticleId] = useState("");

  const load = useCallback(async () => {
    const session = await fetch("/api/auth/session").then((response) => response.json()) as { user: SessionUser | null };
    if (!session.user) {
      setUser(null);
      setForcePasswordChange(false);
      setShowLogin(true);
      return;
    }
    if (session.user.mustChangePassword) {
      setUser(null);
      setForcePasswordChange(true);
      setShowLogin(true);
      return;
    }
    setUser(session.user);
    setForcePasswordChange(false);
    const results = await Promise.all([
      fetch("/api/columns?scope=managed"),
      fetch("/api/articles?scope=managed"),
    ]);
    if (!results[0].ok || !results[1].ok) throw new Error("studio");
    const columnData = await results[0].json() as { columns: ApiColumn[] };
    const articleData = await results[1].json() as { articles: ApiArticle[] };
    setColumns(columnData.columns);
    setArticles(articleData.articles);
    setSelectedColumnId((value) => columnData.columns.some((column) => column.id === value) ? value : columnData.columns[0]?.id || "");
  }, []);

  const loadRecovery = useCallback(async () => {
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      const results = await Promise.all([
        fetch("/api/columns?scope=managed&includeDeleted=1"),
        fetch("/api/articles?scope=managed&includeDeleted=1"),
      ]);
      if (!results[0].ok || !results[1].ok) throw new Error("recovery");
      const columnData = await results[0].json() as { columns: ApiColumn[] };
      const articleData = await results[1].json() as { articles: ApiArticle[] };
      setDeletedColumns(columnData.columns.filter((column) => Boolean(column.deletedAt)));
      setDeletedArticles(articleData.articles.filter((article) => article.status === "deleted"));
    } catch (error) {
      setRecoveryError("恢复内容加载失败，请重试。");
      throw error;
    } finally {
      setRecoveryLoading(false);
    }
  }, []);

  useEffect(() => { void load().catch(() => onNotice("后台数据加载失败")); }, [load, onNotice]);
  useEffect(() => {
    if (user && panel === "recovery") void loadRecovery().catch(() => onNotice("回收内容加载失败"));
  }, [loadRecovery, onNotice, panel, user]);

  const createColumn = async () => {
    const response = await fetch("/api/columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "未命名专栏", description: "" }) });
    if (!response.ok) return onNotice("创建专栏失败");
    const data = await response.json() as { column: ApiColumn };
    setColumns((value) => value.concat(data.column));
    setSelectedColumnId(data.column.id);
    onNotice("专栏已创建");
  };

  const openCreate = (columnId?: string) => setCreateDestination(columnId || articleColumnFilter || (columns.length === 1 ? columns[0].id : ""));
  const createArticle = async (columnId: string, title: string) => {
    const response = await fetch("/api/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columnId, title: title.trim() || "未命名文章", bodyMarkdown: "", status: "draft" }) });
    const data = await response.json() as { article: ApiArticle; error?: string };
    if (!response.ok) throw new Error(data.error || "创建文章失败");
    setArticles((value) => value.concat(data.article));
    setArticleColumnFilter((value) => value ? columnId : "");
    setArticleStatusFilter("all"); setFocusArticleId(data.article.id); setPanel("articles");
    setColumns((value) => value.map((column) => column.id === columnId ? { ...column, articleCount: (column.articleCount || 0) + 1 } : column));
    onNotice("草稿已创建");
  };
  const movedArticle = (article: ApiArticle) => {
    setArticleColumnFilter((value) => value ? article.columnId : "");
    setArticles((value) => value.map((item) => item.id === article.id ? article : item));
    void load().catch(() => onNotice("文章已移动，列表刷新失败，请刷新页面。"));
    onNotice("文章已移动，公开链接保持不变");
  };

  const updateArticle = (article: ApiArticle) => {
    setArticles((value) => article.status === "deleted" ? value.filter((item) => item.id !== article.id) : value.map((item) => item.id === article.id ? article : item));
  };
  const updateColumn = (column: ApiColumn) => {
    if (column.deletedAt) {
      setColumns((value) => value.filter((item) => item.id !== column.id));
      setArticles((value) => value.filter((item) => item.columnId !== column.id));
      setSelectedColumnId((value) => value === column.id ? "" : value);
      setArticleColumnFilter((value) => value === column.id ? "" : value);
      return;
    }
    setColumns((value) => value.map((item) => item.id === column.id ? column : item));
  };
  const restoreArticle = async (article: ApiArticle) => {
    if (!Number.isInteger(article.version)) return onNotice("文章版本信息无效");
    const response = await fetch("/api/articles/" + article.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: article.version, action: "restore", status: "draft" }) });
    if (!response.ok) {
      const data = await response.json() as { error?: string };
      if (response.status === 409) await loadRecovery();
      return onNotice(data.error || "文章恢复失败");
    }
    await load();
    await loadRecovery();
    onNotice("文章已恢复为草稿");
  };
  const restoreColumn = async (column: ApiColumn) => {
    const response = await fetch("/api/columns/" + column.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore" }) });
    if (!response.ok) return onNotice("专栏恢复失败");
    await load();
    await loadRecovery();
    onNotice("专栏已恢复");
  };
  const loggedIn = (next: SessionUser) => { setUser(next); setForcePasswordChange(false); setShowLogin(false); void load(); };

  return <div className={"studio-page " + studioStyles.workspace}>
    <header className="studio-header"><button className="back-link" onClick={onBack}>← {SITE_NAME}</button><div><strong>工作台</strong>{user && <span>{user.displayName} · {user.role === "owner" ? "Owner" : "作者"}</span>}</div><button className="text-button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); setShowLogin(true); setForcePasswordChange(false); }}>退出</button></header>
    {user ? <div className="studio-layout">
      <nav className="studio-nav" aria-label="后台导航">
        <button className={panel === "articles" ? "active" : ""} onClick={() => setPanel("articles")}>文章</button>
        <button className={panel === "columns" ? "active" : ""} onClick={() => setPanel("columns")}>专栏</button>
        <button className={panel === "recovery" ? "active" : ""} onClick={() => setPanel("recovery")}>恢复</button>
        <button className={panel === "members" ? "active" : ""} onClick={() => setPanel("members")}>成员与权限</button>
        <button className={panel === "profile" ? "active" : ""} onClick={() => setPanel("profile")}>我的资料</button>
      </nav>
      <section className="studio-content">
        {panel === "articles" && <><div className="panel-heading"><div><p className="eyebrow">写作</p><h1>文章</h1></div><div className="panel-heading-actions"><button className="button button-muted" onClick={() => setPanel("recovery")}>恢复文章</button><button className="button button-dark" onClick={() => openCreate()}>新建文章</button></div></div><div className="article-filters"><label>专栏<select aria-label="筛选专栏" value={articleColumnFilter} onChange={(event) => setArticleColumnFilter(event.target.value)}><option value="">全部专栏</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select></label><label>状态<select aria-label="筛选状态" value={articleStatusFilter} onChange={(event) => setArticleStatusFilter(event.target.value)}><option value="all">全部状态</option><option value="draft">草稿</option><option value="published">已发布</option></select></label></div><ArticleEditor user={user} focusArticleId={focusArticleId} articles={articles.filter((article) => (!articleColumnFilter || article.columnId === articleColumnFilter) && (articleStatusFilter === "all" || article.status === articleStatusFilter))} columns={columns} onArticle={updateArticle} onMoved={movedArticle} onNotice={onNotice} /></>}
        {panel === "columns" && <><div className="panel-heading"><div><p className="eyebrow">结构</p><h1>专栏</h1></div><div className="panel-heading-actions"><button className="button button-muted" onClick={() => setPanel("recovery")}>恢复专栏</button><button className="button button-dark" onClick={() => void createColumn()}>新建专栏</button></div></div><ColumnManager onCreateArticle={(columnId) => openCreate(columnId)} columns={columns} articles={articles} selectedColumnId={selectedColumnId} onSelect={setSelectedColumnId} onUpdate={updateColumn} onNotice={onNotice} /></>}
        {panel === "recovery" && <><div className="panel-heading"><div><p className="eyebrow">回收站</p><h1>恢复</h1></div><button className="text-button" onClick={() => setPanel("articles")}>返回文章</button></div><RecoveryManager user={user} error={recoveryError} onRetry={() => void loadRecovery().catch(() => onNotice("回收内容加载失败"))} onNotice={onNotice} columns={deletedColumns} articles={deletedArticles} loading={recoveryLoading} onRestoreColumn={restoreColumn} onRestoreArticle={restoreArticle} /></>}
        {panel === "members" && <><div className="panel-heading"><div><p className="eyebrow">协作</p><h1>成员与权限</h1></div></div><MemberManager owner={user.role === "owner"} columns={columns} selectedColumnId={selectedColumnId} onSelectColumn={setSelectedColumnId} onNotice={onNotice} /></>}
        {panel === "profile" && <ProfilePanel user={user} onUser={setUser} onNotice={onNotice} />}
      </section>
    </div> : <EmptyState text="请登录后台。" />}
    {createDestination !== null && <ArticleDestinationDialog mode="create" columns={columns} initialColumnId={createDestination} onClose={() => setCreateDestination(null)} onSubmit={createArticle} />}
    {showLogin && <LoginModal initialMustChange={forcePasswordChange} onSuccess={loggedIn} onClose={() => { if (forcePasswordChange) return; setShowLogin(false); onBack(); }} />}
  </div>;
}

function LoginModal({ onSuccess, onClose, initialMustChange = false }: { onSuccess: (user: SessionUser) => void; onClose: () => void; initialMustChange?: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mustChange, setMustChange] = useState(initialMustChange);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(mustChange ? "/api/auth/change-password" : "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mustChange ? { currentPassword: password, newPassword } : { username, password }),
      });
      const data = await response.json() as { user?: SessionUser; mustChangePassword?: boolean; error?: string };
      if (!response.ok) { setError(data.error || "操作失败，请重试。"); return; }
      if (!mustChange && data.mustChangePassword) { setMustChange(true); setVisible(false); return; }
      if (mustChange) {
        const response = await fetch("/api/auth/session");
        const session = await response.json() as { user?: SessionUser };
        if (!response.ok || !session.user) { setError("密码已更新，请重新登录。"); setMustChange(false); setPassword(""); setNewPassword(""); return; }
        onSuccess(session.user);
      } else if (data.user) onSuccess(data.user);
      else setError("暂时无法登录，请稍后重试。");
    } catch { setError("连接失败，请检查网络后重试。"); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="studio-auth" aria-labelledby="auth-title" aria-describedby="auth-description" onCancel={(event) => { event.preventDefault(); if (!mustChange && !busy) onClose(); }}>
    <div className="auth-layout">
      <aside className="auth-story">
        <div className="auth-brand"><span aria-hidden="true">G</span>{SITE_NAME}<small>STUDIO</small></div>
        <div className="auth-story-copy"><p className="auth-kicker">留给思考，也留给表达</p><h2>让想法落笔，<br />让文字生长。</h2><p>整理灵感，沉淀知识。<br />从这里，继续你的下一篇。</p></div>
        <div className="auth-story-footer"><span aria-hidden="true">01 /</span> 一个安静的写作空间</div>
      </aside>
      <section className="auth-main">
        {!mustChange && <button className="auth-back" type="button" onClick={onClose} disabled={busy}>← 返回博客</button>}
        <div className="auth-heading"><p className="auth-kicker">{mustChange ? "ACCOUNT SECURITY" : "WELCOME BACK"}</p><h1 id="auth-title">{mustChange ? "设置你的新密码" : "欢迎回到工作台"}</h1><p id="auth-description">{mustChange ? "首次登录，请先更新初始密码以保护你的账号。" : "登录账号，继续创作与管理你的内容。"}</p></div>
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy}>
            {!mustChange && <label htmlFor="auth-username">用户名<input id="auth-username" name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="输入你的用户名" required /></label>}
            <label htmlFor="auth-password">{mustChange ? "当前密码" : "密码"}</label>
            <div className="auth-password"><input id="auth-password" name="password" type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder={mustChange ? "输入初始密码" : "输入你的密码"} required /><button type="button" aria-controls="auth-password" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "隐藏" : "显示"}</button></div>
            {mustChange && <label htmlFor="auth-new-password">新密码<input id="auth-new-password" name="newPassword" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} aria-describedby="auth-password-hint" placeholder="设置至少 12 位的新密码" required /><small id="auth-password-hint">至少 12 位，建议组合字母、数字和符号。</small></label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit">{busy ? (mustChange ? "正在保存…" : "正在登录…") : (mustChange ? "保存并进入工作台" : "登录工作台")}<span aria-hidden="true">{busy ? "…" : "→"}</span></button>
          </fieldset>
        </form>
        <p className="auth-help">{mustChange ? "更新密码后，即可开始使用工作台。" : "仅限受邀作者使用 · 如需账号或重置密码，请联系管理员。"}</p>
        <div className="auth-footer">{SITE_NAME}<span>专注记录，自在表达。</span></div>
      </section>
    </div>
  </dialog>;
}

function ArticleEditor({ user, focusArticleId, articles, columns, onArticle, onMoved, onNotice }: { user: SessionUser; focusArticleId: string; articles: ApiArticle[]; columns: ApiColumn[]; onArticle: (article: ApiArticle) => void; onMoved: (article: ApiArticle) => void; onNotice: (notice: string) => void }) {
  const [selectedId, setSelectedId] = useState(articles[0]?.id || "");
  const selected = articles.find((article) => article.id === selectedId) || null;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [conflict, setConflict] = useState(false);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusArticleId) setSelectedId(focusArticleId); }, [focusArticleId]);
  useEffect(() => { if (selectedId === focusArticleId) titleInput.current?.focus(); }, [selectedId, focusArticleId]);
  const [editorView, setEditorView] = useState<"write" | "split" | "preview">("split");
  const dirtyStartedAt = useRef<number | null>(null);
  const saving = useRef(false);
  const draftRevision = useRef(0);
  const localKey = selected ? "g0dlog-draft-" + selected.id : "";
  useEffect(() => { const next = articles.find((article) => article.id === selectedId) || articles[0]; if (next && next.id !== selectedId) setSelectedId(next.id); }, [articles, selectedId]);
  useEffect(() => { if (!selected) return; draftRevision.current += 1; setDirty(false); dirtyStartedAt.current = null; let nextTitle = selected.title; let nextBody = selected.bodyMarkdown; try { const local = JSON.parse(localStorage.getItem(localKey) || "null") as { title?: string; body?: string } | null; if (local && (local.title !== selected.title || local.body !== selected.bodyMarkdown)) { nextTitle = local.title || nextTitle; nextBody = local.body || nextBody; setDirty(true); dirtyStartedAt.current = Date.now(); } } catch { /* malformed local drafts are ignored */ } setTitle(nextTitle); setBody(nextBody); setConflict(false); setSaveState("saved"); }, [selected?.id]);
  const save = useCallback(async (kind: "autosave" | "publish", status?: "draft" | "published") => {
    if (!selected || conflict || saving.current) return false;
    saving.current = true; const revision = draftRevision.current; setSaveState("saving");
    try {
      const response = await fetch("/api/articles/" + selected.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: selected.version, title, bodyMarkdown: body, status: status || selected.status, saveKind: kind }) });
      if (response.status === 409) { setConflict(true); setSaveState("failed"); return false; }
      if (!response.ok) { setSaveState("failed"); return false; }
      const data = await response.json() as { article: ApiArticle };
      onArticle(data.article);
      if (revision === draftRevision.current) { setDirty(false); dirtyStartedAt.current = null; localStorage.removeItem(localKey); }
      setSaveState("saved");
      return data.article;
    } catch { setSaveState("failed"); return false; }
    finally { saving.current = false; }
  }, [body, conflict, localKey, onArticle, selected, title]);
  useEffect(() => { if (!dirty || !selected || moveOpen || restoring) return; const started = dirtyStartedAt.current || Date.now(); const elapsed = Date.now() - started; const delay = elapsed >= 30000 ? 0 : Math.min(3000, 30000 - elapsed); const timer = window.setTimeout(() => void save("autosave"), delay); return () => window.clearTimeout(timer); }, [dirty, save, selected, moveOpen, restoring]);
  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { if (dirty || saveState === "saving") { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler); }, [dirty, saveState]);
  const setDraft = (nextTitle: string, nextBody: string) => { draftRevision.current += 1; setTitle(nextTitle); setBody(nextBody); if (!dirtyStartedAt.current) dirtyStartedAt.current = Date.now(); setDirty(true); if (localKey) localStorage.setItem(localKey, JSON.stringify({ title: nextTitle, body: nextBody })); };
  const loadVersions = async () => { if (!selected) return; const response = await fetch("/api/articles/" + selected.id + "/versions"); if (!response.ok) return onNotice("版本历史加载失败"); const data = await response.json() as { versions: ApiVersion[] }; setVersions(data.versions); setShowHistory(true); };
  const restore = async (version: ApiVersion) => {
    if (!selected || saving.current) return;
    saving.current = true; setRestoring(true);
    try {
      const response = await fetch("/api/articles/" + selected.id + "/versions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: version.version, currentVersion: selected.version }) });
      if (response.status === 409) { setConflict(true); return; }
      if (!response.ok) throw new Error("版本恢复失败");
      const data = await response.json() as { article: ApiArticle };
      draftRevision.current += 1;
      setTitle(data.article.title); setBody(data.article.bodyMarkdown); setDirty(false);
      dirtyStartedAt.current = null;
      try { localStorage.removeItem(localKey); } catch { /* Browser storage may be unavailable. */ }
      setSaveState("saved"); setConflict(false); onArticle(data.article); setShowHistory(false);
      onNotice("版本已恢复，未新增自动保存记录");
    } catch { onNotice("版本恢复失败，请重试"); }
    finally { saving.current = false; setRestoring(false); }
  };
  const reloadLatest = async () => { if (!selected) return; const response = await fetch("/api/articles/" + selected.id); if (!response.ok) return onNotice("最新版本加载失败"); const data = await response.json() as { article: ApiArticle }; setTitle(data.article.title); setBody(data.article.bodyMarkdown); setDirty(false); dirtyStartedAt.current = null; setConflict(false); onArticle(data.article); onNotice("已加载最新版本"); };
  const changeDeletion = async () => { if (!selected) return; const response = await fetch("/api/articles/" + selected.id, { method: "DELETE" }); if (!response.ok) return onNotice("文章删除失败"); const data = await response.json() as { article: Partial<ApiArticle> }; onArticle({ ...selected, ...data.article, status: "deleted" }); setDirty(false); dirtyStartedAt.current = null; onNotice("文章已移入恢复页"); };
  const upload = async (file: File) => { const form = new FormData(); form.set("file", file); const response = await fetch("/api/media", { method: "POST", body: form }); const data = await response.json() as { url?: string; error?: string }; if (!response.ok || !data.url) return onNotice(data.error || "图片上传失败"); setDraft(title, body + (body ? "\n\n" : "") + "![" + file.name + "](" + data.url + ")"); onNotice("图片已上传"); };
  const onFiles = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; };
  const onDrop = (event: DragEvent<HTMLFieldSetElement>) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void upload(file); };
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => { const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/")); if (!file) return; event.preventDefault(); void upload(file); };
  if (!selected) return <EmptyState text="暂无可编辑文章。" />;
  const column = columns.find((item) => item.id === selected.columnId);
  const moveArticle = async (columnId: string) => {
    let current = selected;
    if (dirty) {
      try { const saved = await save("autosave"); if (!saved) throw new Error(); current = saved; }
      catch { throw new Error("保存失败，请先解决保存问题再移动文章。"); }
    }
    const response = await fetch("/api/articles/" + current.id + "/move", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columnId, version: current.version }) });
    const data = await response.json() as { article: ApiArticle; error?: string };
    if (!response.ok) { if (response.status === 409) setConflict(true); throw new Error(data.error || "移动失败，请重试。"); }
    onMoved(data.article);
  };
  return <div className="editor-layout">{moveOpen && <ArticleDestinationDialog mode="move" published={selected.status === "published"} columns={columns.filter((item) => item.id !== selected.columnId)} onClose={() => setMoveOpen(false)} onSubmit={moveArticle} />}<aside className="editor-list"><div className="list-toolbar"><strong>文章</strong><span>{articles.length}</span></div>{articles.map((article) => <button className={article.id === selected.id ? "selected" : ""} key={article.id} disabled={restoring} onClick={() => setSelectedId(article.id)}><span className={"status-dot " + article.status} /><span><strong>{article.title}</strong><small>{article.status === "published" ? "已发布" : "草稿"} · {columns.find((item) => item.id === article.columnId)?.title}</small></span></button>)}</aside><section className="editor-panel"><div className="editor-toolbar"><span className={"save-state " + saveState}>{saveState === "saving" ? "正在保存" : saveState === "failed" ? "保存失败" : dirty ? "待保存" : "已保存"}</span><div className="editor-actions"><label className="upload-button">上传图片<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFiles} /></label><button className="text-button" aria-expanded={showHistory} onClick={() => showHistory ? setShowHistory(false) : void loadVersions()}>版本历史</button><button className="text-button danger" disabled={restoring} onClick={() => void changeDeletion()}>删除文章</button><button className="button button-dark" disabled={restoring || selected.status === "deleted" || conflict} onClick={() => void save("publish", "published")}>发布</button></div></div>{conflict && <div className="conflict-banner" role="alert"><strong>检测到内容冲突</strong><span>当前输入已保留，请复制内容后加载最新版本。</span><button onClick={() => void reloadLatest()}>加载最新版</button><button onClick={() => setConflict(false)}>关闭</button></div>}{showHistory && <div className="history-panel"><div className="history-heading"><strong>版本历史</strong><button className="text-button" onClick={() => setShowHistory(false)}>关闭</button></div>{!versions.length && <p className="muted">暂无保存的版本。</p>}{versions.map((version) => <button key={version.version} disabled={restoring || saveState === "saving"} onClick={() => void restore(version)}>版本 {version.version} · {version.kind === "publish" ? "发布快照" : version.kind === "delete" ? "删除快照" : "自动保存"} · {displayDate(version.createdAt)}</button>)}</div>}<fieldset disabled={restoring} className="editor-writing" onDrop={onDrop} onDragOver={(event) => event.preventDefault()}><input ref={titleInput} className="editor-title" value={title} onChange={(event) => setDraft(event.target.value, body)} aria-label="文章标题" placeholder="文章标题" /><div className="editor-meta-row"><span>所属专栏：</span>{user.role === "owner" || column?.creatorId === user.id ? <button className="text-button" disabled={saveState === "saving" || conflict} onClick={() => setMoveOpen(true)}>{column?.title} ▾</button> : <span>{column?.title}</span>}<span>· {selected.status === "published" ? "已发布" : "草稿"}</span></div><div className="editor-view-bar"><div className="editor-view-switch" role="group" aria-label="编辑器视图">{([ ["write", "写作"], ["split", "对照"], ["preview", "预览"] ] as const).map(([value, label]) => <button key={value} aria-pressed={editorView === value} onClick={() => setEditorView(value)}>{label}</button>)}</div><span>支持 Markdown · 可粘贴或拖入图片</span></div><div className={"editor-split view-" + editorView}><textarea value={body} onPaste={onPaste} onChange={(event) => setDraft(title, event.target.value)} aria-label="Markdown 源码" placeholder="用 Markdown 写作…" /><div className="editor-preview" aria-label="文章预览">{body ? <ArticleBody markdown={body} /> : <p className="preview-empty">文字将在这里呈现。开始写作，预览你的文章。</p>}</div></div></fieldset></section></div>;
}

function RecoveryManager({ user, columns, articles, loading, error, onRetry, onNotice, onRestoreColumn, onRestoreArticle }: { user: SessionUser; columns: ApiColumn[]; articles: ApiArticle[]; loading: boolean; error: string; onRetry: () => void; onNotice: (notice: string) => void; onRestoreColumn: (column: ApiColumn) => Promise<void>; onRestoreArticle: (article: ApiArticle) => Promise<void> }) {
  const [pending, setPending] = useState("");
  const restoring = useRef(false);
  const restore = async (id: string, action: () => Promise<void>) => {
    if (restoring.current) return;
    restoring.current = true; setPending(id);
    try { await action(); }
    catch { onNotice("操作或刷新失败，请重新加载恢复页确认结果后重试。"); }
    finally { restoring.current = false; setPending(""); }
  };
  if (error) return <div role="alert"><p>{error}</p><button className="button button-muted" disabled={loading} onClick={onRetry}>重新加载</button></div>;
  return <div className="recovery-page" aria-busy={loading || Boolean(pending)}>
    <section className="recovery-section"><div className="manager-subhead"><strong>已删除文章</strong><span>{articles.length} 篇</span></div>{loading ? <p className="muted">正在加载恢复内容…</p> : articles.length ? <div className="recovery-list">{articles.map((article) => { const columnDeleted = columns.some((column) => column.id === article.columnId); return <div className="recovery-row" key={article.id}><div><strong>{article.title}</strong><small>{article.columnTitle || "未命名专栏"} · {columnDeleted ? "所属专栏已删除" : "可恢复为草稿"}</small></div><button className="button button-muted" disabled={columnDeleted || Boolean(pending)} onClick={() => void restore(article.id, () => onRestoreArticle(article))}>{pending === article.id ? "正在恢复…" : columnDeleted ? "先恢复专栏" : "恢复文章"}</button></div>; })}</div> : <p className="muted">暂无已删除文章。</p>}</section>
    <section className="recovery-section"><div className="manager-subhead"><strong>已删除专栏</strong><span>{columns.length} 个</span></div>{loading ? <p className="muted">正在加载恢复内容…</p> : columns.length ? <div className="recovery-list">{columns.map((column) => { const canRestore = user.role === "owner" || column.creatorId === user.id; return <div className="recovery-row" key={column.id}><div><strong>{column.title}</strong><small>{column.articleCount || 0} 篇未删除文章 · 删除后内容仍保留</small></div><button className="button button-muted" disabled={!canRestore || Boolean(pending)} onClick={() => void restore(column.id, () => onRestoreColumn(column))}>{pending === column.id ? "正在恢复…" : canRestore ? "恢复专栏" : "请联系专栏管理员恢复"}</button></div>; })}</div> : <p className="muted">暂无已删除专栏。</p>}</section>
  </div>;
}

function ColumnManager({ onCreateArticle, columns, articles, selectedColumnId, onSelect, onUpdate, onNotice }: { onCreateArticle: (columnId: string) => void; columns: ApiColumn[]; articles: ApiArticle[]; selectedColumnId: string; onSelect: (id: string) => void; onUpdate: (column: ApiColumn) => void; onNotice: (notice: string) => void }) {
  const selected = columns.find((column) => column.id === selectedColumnId) || columns[0]; if (!selected) return <EmptyState text="暂无专栏。" />;
  const columnArticles = articles.filter((article) => article.columnId === selected.id && article.status !== "deleted").sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const remove = async () => { const response = await fetch("/api/columns/" + selected.id, { method: "DELETE" }); if (!response.ok) return onNotice("专栏删除失败"); onUpdate({ ...selected, deletedAt: new Date().toISOString() }); onNotice("专栏已移入恢复页"); };
  const order = async (next: ApiArticle[]) => { const response = await fetch("/api/columns/" + selected.id + "/articles/order", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleIds: next.map((article) => article.id) }) }); if (!response.ok) return onNotice("文章顺序保存失败"); onNotice("文章顺序已保存"); };
  return <div className="manager-page"><div className="manager-list"><div className="list-toolbar"><strong>专栏</strong><span>{columns.length}</span></div>{columns.map((column) => <button key={column.id} className={column.id === selected.id ? "selected" : ""} onClick={() => onSelect(column.id)}><strong>{column.title}</strong><small>{(column.articleCount || 0) + " 篇文章"}</small></button>)}</div><div className="manager-detail"><button className="button button-dark column-create-article" onClick={() => onCreateArticle(selected.id)}>在此专栏新建文章</button><ColumnInfoForm key={selected.id} column={selected} onSaved={(info) => onUpdate({ ...selected, ...info })} onDelete={() => void remove()} /><div className="order-panel"><div className="manager-subhead"><strong>文章顺序</strong><span>使用箭头调整展示顺序</span></div>{!columnArticles.length && <p className="muted">这个专栏还没有文章。</p>}{columnArticles.map((article, index) => <div className="order-row" key={article.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{article.title}</strong><button aria-label="上移" disabled={!index} onClick={() => { const next = columnArticles.slice(); [next[index - 1], next[index]] = [next[index], next[index - 1]]; void order(next); }}>↑</button><button aria-label="下移" disabled={index === columnArticles.length - 1} onClick={() => { const next = columnArticles.slice(); [next[index], next[index + 1]] = [next[index + 1], next[index]]; void order(next); }}>↓</button></div>)}</div></div></div>;
}

function MemberManager({ owner, columns, selectedColumnId, onSelectColumn, onNotice }: { owner: boolean; columns: ApiColumn[]; selectedColumnId: string; onSelectColumn: (id: string) => void; onNotice: (notice: string) => void }) {
  type Member = { id: string; username: string; displayName: string; role: string; status: "active" | "disabled"; membershipStatus?: "active" | "removed" };
  type Account = { id: string; username: string; displayName: string; role: "owner" | "author"; status: "active" | "disabled"; mustChangePassword: boolean };
  const selected = columns.find((column) => column.id === selectedColumnId) || columns[0]; const [members, setMembers] = useState<Member[]>([]); const [available, setAvailable] = useState<Member[]>([]); const [accounts, setAccounts] = useState<Account[]>([]); const [inviteId, setInviteId] = useState(""); const [newUser, setNewUser] = useState({ username: "", displayName: "", password: "" });
  const load = useCallback(async () => { if (!selected) return; const response = await fetch("/api/columns/" + selected.id + "/members"); if (!response.ok) return; const data = await response.json() as { members: Member[]; availableUsers: Member[] }; setMembers(data.members); setAvailable(data.availableUsers); if (owner) { const usersResponse = await fetch("/api/admin/users"); if (usersResponse.ok) setAccounts((await usersResponse.json() as { users: Account[] }).users); } }, [owner, selected?.id]); useEffect(() => { void load(); }, [load]); if (!selected) return <EmptyState text="暂无专栏。" />;
  const invite = async () => { const response = await fetch("/api/columns/" + selected.id + "/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: inviteId }) }); if (!response.ok) return onNotice("邀请失败"); setInviteId(""); await load(); onNotice("协作者已邀请"); };
  const remove = async (id: string) => { const response = await fetch("/api/columns/" + selected.id + "/members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id }) }); if (!response.ok) return onNotice("移除失败"); await load(); onNotice("协作者已移除，既有文章保留"); };
  const create = async () => { const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser) }); const data = await response.json() as { error?: string }; if (!response.ok) return onNotice(data.error || "作者创建失败"); setNewUser({ username: "", displayName: "", password: "" }); await load(); onNotice("作者账号已创建"); };
  const accountAction = async (id: string, action: "disable" | "enable" | "reset_password") => { const response = await fetch("/api/admin/users/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const data = await response.json() as { error?: string; temporaryPassword?: string }; if (!response.ok) return onNotice(data.error || "账号操作失败"); await load(); onNotice(action === "reset_password" ? "临时密码：" + data.temporaryPassword : action === "disable" ? "账号已停用" : "账号已恢复"); };
  return <div className="member-page"><div className="member-column-head"><label>当前专栏<select value={selected.id} onChange={(event) => onSelectColumn(event.target.value)}>{columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select></label></div><div className="member-grid"><section className="member-section"><div className="manager-subhead"><strong>协作者</strong><span>{members.filter((member) => member.membershipStatus === "active").length} 位</span></div>{members.filter((member) => member.membershipStatus === "active").map((member) => <div className="member-row" key={member.id}><span><strong>{member.displayName}</strong><small>{member.username}</small></span><button className="text-button danger" onClick={() => void remove(member.id)}>移除</button></div>)}{!members.some((member) => member.membershipStatus === "active") && <p className="muted">暂无协作者，可在下方邀请作者加入。</p>}<div className="invite-row"><select aria-label="选择协作者" value={inviteId} onChange={(event) => setInviteId(event.target.value)}><option value="">选择启用作者</option>{available.filter((member) => !members.some((current) => current.id === member.id && current.membershipStatus === "active")).map((member) => <option key={member.id} value={member.id}>{member.displayName}（{member.username}）</option>)}</select><button className="button button-dark" disabled={!inviteId} onClick={() => void invite()}>邀请</button></div><p className="muted">移除协作者不会删除其既有公开文章。</p></section>{owner && <section className="member-section"><div className="manager-subhead"><strong>创建作者</strong><span>账号由 Owner 掌控</span></div><label>显示名称<input value={newUser.displayName} onChange={(event) => setNewUser({ ...newUser, displayName: event.target.value })} placeholder="显示名称" /></label><label>用户名<input autoComplete="off" value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} placeholder="用户名" /></label><label>初始密码<input autoComplete="new-password" type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="初始密码（至少 12 位）" /></label><button className="button button-dark" disabled={!newUser.username || !newUser.displayName || newUser.password.length < 12} onClick={() => void create()}>新建作者</button></section>}{owner && <section className="member-section account-section"><div className="manager-subhead"><strong>账号状态</strong><span>只有 Owner 可操作</span></div>{accounts.map((account) => <div className="member-row" key={account.id}><span><strong>{account.displayName}</strong><small>{account.role === "owner" ? "Owner" : account.username} · {account.status === "active" ? "启用" : "停用"}{account.mustChangePassword ? " · 首次登录改密" : ""}</small></span><div><button className="text-button" disabled={account.role === "owner"} onClick={() => void accountAction(account.id, account.status === "active" ? "disable" : "enable")}>{account.status === "active" ? "停用" : "恢复"}</button>{account.role !== "owner" && <button className="text-button" onClick={() => void accountAction(account.id, "reset_password")}>重置密码</button>}</div></div>)}</section>}</div></div>;
}

function ProfilePanel({ user, onUser, onNotice }: { user: SessionUser; onUser: (user: SessionUser) => void; onNotice: (notice: string) => void }) {
  const [displayName, setDisplayName] = useState(user.displayName); const [signature, setSignature] = useState(user.signature || ""); const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || ""); const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState("");
  const save = async () => { const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, signature, avatarUrl }) }); if (!response.ok) return onNotice("资料保存失败"); const data = await response.json() as { user: SessionUser }; onUser(data.user); onNotice("公开资料已保存"); };
  const changePassword = async () => { const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) }); const data = await response.json() as { error?: string }; if (!response.ok) return onNotice(data.error || "密码修改失败"); setCurrentPassword(""); setNewPassword(""); onNotice("密码已修改，其他会话已失效"); };
  return <div className="profile-page"><div className="panel-heading"><div><p className="eyebrow">公开信息</p><h1>我的资料</h1></div></div><div className="form-block"><label>显示名称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>头像地址<input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="可选的 HTTPS 图片地址" /></label><label>简介<textarea value={signature} onChange={(event) => setSignature(event.target.value)} rows={4} /></label><button className="button button-dark" onClick={() => void save()}>保存公开资料</button></div><div className="form-block"><h2>修改密码</h2><label>当前密码<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>新密码<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} /></label><button className="button button-dark" onClick={() => void changePassword()} disabled={newPassword.length < 12}>修改密码</button></div></div>;
}
function EmptyState({ text }: { text: string }) { return <div className="empty-state">{text}</div>; }
