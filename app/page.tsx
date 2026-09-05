"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, ReactNode } from "react";

type Author = {
  id: string;
  name: string;
  role: string;
  bio: string;
  initials: string;
  color: string;
};

type Member = {
  id: string;
  name: string;
  username: string;
  role: "管理员" | "作者";
  status: "active" | "disabled";
  joinedAt: string;
  articleCount: number;
  initials: string;
  color: string;
  mustChangePassword: boolean;
};

type Column = {
  id: string;
  title: string;
  description: string;
  authorId: string;
  count: number;
  updated: string;
  accent: string;
  deleted?: boolean;
};

type Block =
  | { type: "heading"; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "code"; language: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "image"; src: string; alt: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; title: string; text: string };

type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  columnId: string;
  authorId: string;
  firstPublished: string;
  updated: string;
  readTime: string;
  status: "published" | "draft" | "deleted";
  body: Block[];
  bodyMarkdown?: string;
  version?: number;
};

type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "author";
  mustChangePassword?: boolean;
};

type ApiColumn = {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName?: string;
  articleCount?: number;
  updatedAt?: string;
  latestPublishedAt?: string | null;
  deletedAt?: string | null;
};

type ApiArticle = {
  id: string;
  slug: string;
  columnId: string;
  authorId: string;
  authorName?: string;
  title: string;
  bodyMarkdown: string;
  status: "draft" | "published" | "deleted";
  firstPublishedAt?: string | null;
  lastPublishedAt?: string | null;
  version?: number;
};

type ApiVersion = {
  version: number;
  title: string;
  bodyMarkdown: string;
  createdAt: string;
};

const authors: Author[] = [
  {
    id: "author-chen",
    name: "陈默",
    role: "写作者 / 工程师",
    bio: "记录系统、工具和那些值得慢慢想清楚的事。",
    initials: "CM",
    color: "#1f6f68",
  },
  {
    id: "author-lin",
    name: "林遥",
    role: "设计师 / 观察者",
    bio: "把复杂的体验，折叠成可被理解的形状。",
    initials: "LY",
    color: "#b36b3f",
  },
  {
    id: "author-sun",
    name: "孙野",
    role: "独立开发者",
    bio: "在产品与代码之间，寻找更轻的解法。",
    initials: "SY",
    color: "#6a5b9b",
  },
];

const memberDirectory: Member[] = [
  { id: "author-chen", name: "陈默", username: "chen", role: "管理员", status: "active", joinedAt: "2024 年 01 月 08 日", articleCount: 14, initials: "CM", color: "#1f6f68", mustChangePassword: false },
  { id: "author-lin", name: "林遥", username: "linyao", role: "作者", status: "active", joinedAt: "2024 年 02 月 14 日", articleCount: 8, initials: "LY", color: "#b36b3f", mustChangePassword: false },
  { id: "author-sun", name: "孙野", username: "sunye", role: "作者", status: "active", joinedAt: "2024 年 03 月 02 日", articleCount: 5, initials: "SY", color: "#6a5b9b", mustChangePassword: true },
  { id: "author-gu", name: "顾舟", username: "guzhou", role: "作者", status: "active", joinedAt: "—", articleCount: 0, initials: "GZ", color: "#637b8b", mustChangePassword: true },
];

const columns: Column[] = [
  {
    id: "column-systems",
    title: "系统与秩序",
    description: "关于软件、工作流，以及如何把混乱变成可以行动的结构。",
    authorId: "author-chen",
    count: 12,
    updated: "2024 年 06 月 18 日",
    accent: "teal",
  },
  {
    id: "column-presence",
    title: "在场的技术",
    description: "技术如何进入日常，也如何重新定义我们与世界相处的方式。",
    authorId: "author-lin",
    count: 8,
    updated: "2024 年 06 月 12 日",
    accent: "orange",
  },
  {
    id: "column-reading",
    title: "读书与生活",
    description: "从书页、街道和一杯咖啡里，收集一些不急着下结论的观察。",
    authorId: "author-sun",
    count: 5,
    updated: "2024 年 05 月 29 日",
    accent: "violet",
  },
];

const articles: Article[] = [
  {
    id: "article-focus",
    slug: "the-shape-of-focus",
    title: "专注的形状：给复杂工作留出一张白纸",
    excerpt: "当工具越来越多，真正稀缺的不是效率，而是能够完整思考一件事的空间。",
    columnId: "column-systems",
    authorId: "author-chen",
    firstPublished: "2024 年 06 月 18 日",
    updated: "2024 年 06 月 20 日",
    readTime: "8 分钟",
    status: "published",
    body: [
      { type: "paragraph", text: "我们常常把专注理解成一种意志力：关掉通知，戴上耳机，逼自己坐在桌前。但真正困难的地方，可能不是拒绝干扰，而是让眼前的事情拥有一个清晰的边界。" },
      { type: "quote", text: "好的工具不会替你思考，它只会让思考有地方发生。", cite: "— 关于工作空间的一条笔记" },
      { type: "heading", text: "先把问题放在桌面上", id: "put-the-question" },
      { type: "paragraph", text: "我现在会在开始工作前写下一句话：今天要把什么事情推进到什么程度？这句话不需要漂亮，甚至不需要完整。它只是给接下来的一小时提供一个容器。" },
      { type: "list", items: ["一次只打开一个需要作答的问题", "把暂时不相关的想法放进稍后处理的清单", "在结束时留下下一步，而不是留下更多标签"] },
      { type: "heading", text: "让系统替你记住上下文", id: "remember-context" },
      { type: "paragraph", text: "一个好的工作流，不是把人变成机器，而是把机器擅长的记忆和排序交给机器。人则可以把注意力放在判断、取舍和表达上。" },
      { type: "code", language: "text", text: "今天的工作单\n├── 现在：写完一段可发布的文字\n├── 稍后：整理参考资料\n└── 明天：从读者视角再读一遍" },
      { type: "callout", title: "留一点空白", text: "系统的价值不在于把每一分钟填满，而在于当重要的事情出现时，你知道应该把什么暂时放下。" },
    ],
  },
  {
    id: "article-tool",
    slug: "a-tool-should-disappear",
    title: "一个好工具，应该在什么时候消失",
    excerpt: "工具越成熟，越不需要提醒你它的存在。",
    columnId: "column-systems",
    authorId: "author-chen",
    firstPublished: "2024 年 06 月 09 日",
    updated: "2024 年 06 月 09 日",
    readTime: "6 分钟",
    status: "published",
    body: [
      { type: "paragraph", text: "我们很容易被功能列表打动，却很少描述一个工具让人忘记它时的感受。" },
      { type: "heading", text: "从可见到不可见", id: "visible-to-invisible" },
      { type: "paragraph", text: "工具的第一阶段是让能力可见，第二阶段是让能力可靠，最后阶段则是让它悄悄退到背景里。" },
      { type: "quote", text: "Nothing is more invisible than the thing that works.", cite: "— 一则产品设计札记" },
    ],
  },
  {
    id: "article-interface",
    slug: "interface-is-a-promise",
    title: "界面是一种承诺",
    excerpt: "每一次点击之前，界面都在告诉你：接下来会发生什么。",
    columnId: "column-presence",
    authorId: "author-lin",
    firstPublished: "2024 年 06 月 12 日",
    updated: "2024 年 06 月 16 日",
    readTime: "7 分钟",
    status: "published",
    body: [
      { type: "paragraph", text: "界面并不是内容的装饰。它更像一份写给用户的短合同：哪些东西重要，哪些动作可逆，哪里可以放心地继续。" },
      { type: "heading", text: "清楚，比聪明更重要", id: "clear-over-clever" },
      { type: "paragraph", text: "当一个页面需要解释自己，往往是因为视觉层级没有完成它应该完成的工作。" },
      { type: "callout", title: "一个小判断", text: "如果用户必须先学习你的界面，才能完成一件本来就熟悉的事，界面大概率还可以更安静。" },
    ],
  },
  {
    id: "article-sidewalk",
    slug: "walking-without-a-destination",
    title: "没有目的地的散步，也是一种方法",
    excerpt: "在不追求结果的时候，注意力才会重新听见环境。",
    columnId: "column-reading",
    authorId: "author-sun",
    firstPublished: "2024 年 05 月 29 日",
    updated: "2024 年 05 月 29 日",
    readTime: "5 分钟",
    status: "published",
    body: [
      { type: "paragraph", text: "我喜欢在傍晚绕远路回家。不是为了锻炼，也不是为了寻找什么，只是给一天留下一个不被安排的段落。" },
      { type: "heading", text: "注意力的漫游", id: "wandering-attention" },
      { type: "paragraph", text: "街道会把一些微小的东西递到眼前：新换的窗帘、树下的水渍、邻居家的灯。它们不需要被记录，却会让日子变得有纹理。" },
    ],
  },
];

const getAuthor = (id: string) => authors.find((author) => author.id === id) ?? authors[0];
const getColumn = (id: string) => columns.find((column) => column.id === id) ?? columns[0] ?? { id: "", title: "", description: "", authorId: "", count: 0, updated: "—", accent: "teal" };
const upsertAuthor = (id: string, name?: string) => {
  if (!name || authors.some((author) => author.id === id)) return;
  authors.push({ id, name, role: "作者", bio: "", initials: name.slice(0, 2), color: ["#1f6f68", "#b36b3f", "#6a5b9b", "#637b8b"][authors.length % 4] });
};
const displayDate = (value?: string | null) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${year} 年 ${month} 月 ${day} 日`;
};

const headingId = (text: string, index: number) => {
  const readable = text.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return readable || `section-${index + 1}`;
};

const parseMarkdown = (markdown: string): Block[] => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const fence = line.match(/^```\s*([\w-]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) code.push(lines[index++]);
      index += 1;
      blocks.push({ type: "code", language: fence[1] || "text", text: code.join("\n") });
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", text: heading[2].trim(), id: headingId(heading[2], blocks.length) });
      index += 1;
      continue;
    }
    const image = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (image) {
      blocks.push({ type: "image", alt: image[1], src: image[2] });
      index += 1;
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const cells = (value: string) => value.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const headers = cells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) rows.push(cells(lines[index++]));
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) items.push(lines[index++].replace(/^\s*[-*+]\s+/, ""));
      blocks.push({ type: "list", items });
      continue;
    }
    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|^```|^>\s?|^\s*[-*+]\s+|^!\[/.test(lines[index])) {
      if (lines[index].includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) break;
      paragraph.push(lines[index++].trim());
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks.length ? blocks : [{ type: "paragraph", text: "" }];
};

const blockText = (block: Block) => {
  if (block.type === "table") return [...block.headers, ...block.rows.flat()].join(" ");
  if (block.type === "image") return block.alt;
  if (block.type === "list") return block.items.join(" ");
  return "text" in block ? block.text : "";
};

const blocksToMarkdown = (blocks: Block[]) => blocks.map((block) => {
  if (block.type === "heading") return `## ${block.text}`;
  if (block.type === "quote") return `> ${block.text}${block.cite ? `\n> ${block.cite}` : ""}`;
  if (block.type === "code") return `\`\`\`${block.language}\n${block.text}\n\`\`\``;
  if (block.type === "list") return block.items.map((item) => `- ${item}`).join("\n");
  if (block.type === "image") return `![${block.alt}](${block.src})`;
  if (block.type === "table") return `| ${block.headers.join(" | ")} |\n| ${block.headers.map(() => "---").join(" | ")} |\n${block.rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}`;
  if (block.type === "callout") return `> **${block.title}**\n> ${block.text}`;
  return block.text;
}).join("\n\n");
const apiColumnToColumn = (column: ApiColumn): Column => ({
  id: column.id,
  title: column.title,
  description: column.description,
  authorId: column.creatorId,
  count: Number(column.articleCount ?? 0),
  updated: displayDate(column.latestPublishedAt ?? column.updatedAt),
  accent: "teal",
  deleted: Boolean(column.deletedAt),
});
const apiArticleToArticle = (article: ApiArticle): Article => ({
  id: article.id,
  slug: article.slug,
  title: article.title,
  excerpt: article.bodyMarkdown.replace(/[#>*_`()!-]/g, " ").replaceAll("[", " ").replaceAll("]", " ").split(/\s+/).filter(Boolean).join(" ").slice(0, 110),
  columnId: article.columnId,
  authorId: article.authorId,
  firstPublished: displayDate(article.firstPublishedAt),
  updated: displayDate(article.lastPublishedAt),
  readTime: "—",
  status: article.status,
  body: parseMarkdown(article.bodyMarkdown),
  bodyMarkdown: article.bodyMarkdown,
  version: article.version,
});

type View = "home" | "reader" | "studio";

export default function Home({ initialView = "home", initialArticleId, initialColumnId, initialAuthorId }: { initialView?: View; initialArticleId?: string; initialColumnId?: string; initialAuthorId?: string }) {
  const [view, setView] = useState<View>(initialView);
  const [selectedArticleId, setSelectedArticleId] = useState(initialArticleId ?? "article-focus");
  const [searchQuery, setSearchQuery] = useState("");
  const [columnQuery, setColumnQuery] = useState("");
  const [activeColumnId, setActiveColumnId] = useState<string | null>(initialColumnId ?? null);
  const [articlesState, setArticlesState] = useState(articles);
  const [notice, setNotice] = useState("");

  const selectedArticle = articlesState.find((article) => article.id === selectedArticleId) ?? articlesState[0] ?? articles[0];
  const selectedColumn = getColumn(selectedArticle.columnId);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), notice.includes("临时密码") ? 12000 : 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (initialView === "studio") return;
    Promise.all([
      fetch("/api/columns").then((response) => response.ok ? response.json() : Promise.reject(new Error("columns"))),
      fetch("/api/articles").then((response) => response.ok ? response.json() : Promise.reject(new Error("articles"))),
    ]).then(([columnData, articleData]) => {
      const nextColumns = (columnData.columns as ApiColumn[]).map((column) => { upsertAuthor(column.creatorId, column.creatorName); return apiColumnToColumn(column); });
      const nextArticles = (articleData.articles as ApiArticle[]).filter((article) => article.status === "published").map((article) => { upsertAuthor(article.authorId, article.authorName); return apiArticleToArticle(article); });
      if (nextColumns.length) columns.splice(0, columns.length, ...nextColumns);
      if (nextArticles.length) setArticlesState(nextArticles);
    }).catch(() => undefined);
  }, [initialView]);

  const openReader = (articleId: string) => {
    setSelectedArticleId(articleId);
    setView("reader");
    setColumnQuery("");
    window.history.pushState({}, "", `/articles/${articleId}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const publishArticle = (article: Article) => {
    setArticlesState((current) => current.map((item) => item.id === article.id ? article : item));
    setNotice("文章已发布，公开页面已更新");
  };

  return (
    <main className="site-shell">
      {view === "home" && <SiteHeader
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onHome={() => { setView("home"); setSearchQuery(""); }}
        onStudio={() => setView("studio")}
        currentView={view}
      />}
      {view === "home" && (
        <HomeView
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          activeColumnId={activeColumnId}
          setActiveColumnId={setActiveColumnId}
          onOpenArticle={openReader}
          articles={articlesState}
          authorId={initialAuthorId}
        />
      )}
      {view === "reader" && (
        <ReaderView
          article={selectedArticle}
          column={selectedColumn}
          articles={articlesState}
          columnQuery={columnQuery}
          setColumnQuery={setColumnQuery}
          onBack={() => { setView("home"); window.history.pushState({}, "", "/"); }}
          onOpenArticle={openReader}
        />
      )}
      {view === "studio" && (
        <StudioView
          articles={articlesState}
          onBack={() => setView("home")}
          onPublish={publishArticle}
          onNotice={setNotice}
        />
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}

function SiteHeader({
  searchQuery,
  onSearch,
  onHome,
  onStudio,
  currentView,
}: {
  searchQuery: string;
  onSearch: (value: string) => void;
  onHome: () => void;
  onStudio: () => void;
  currentView: View;
}) {
  return (
    <header className="site-header">
      <button className="wordmark" onClick={onHome} aria-label="返回一页首页">
        <span><strong>一页</strong></span>
      </button>
      <div className="header-actions">
        <label className="header-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={searchQuery}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="搜索文章、专栏或作者"
            aria-label="搜索文章、专栏或作者"
          />
        </label>
        <button className={`studio-link ${currentView === "studio" ? "is-active" : ""}`} onClick={onStudio}>
          <span>后台</span>
        </button>
      </div>
    </header>
  );
}

function HomeView({
  searchQuery,
  onSearch,
  activeColumnId,
  setActiveColumnId,
  onOpenArticle,
  articles,
  authorId,
}: {
  searchQuery: string;
  onSearch: (value: string) => void;
  activeColumnId: string | null;
  setActiveColumnId: (value: string | null) => void;
  onOpenArticle: (id: string) => void;
  articles: Article[];
  authorId?: string;
}) {
  const author = authorId ? getAuthor(authorId) : null;
  const visibleColumns = author ? columns.filter((column) => column.authorId === author.id) : columns;
  const filteredArticles = articles.filter((article) => article.status === "published" && (!activeColumnId || article.columnId === activeColumnId) && (!authorId || article.authorId === authorId));
  const searchTerm = searchQuery.trim().toLowerCase();
  const searchResults = searchTerm
    ? {
        articles: articles.filter((article) => article.status === "published" && [article.title, article.excerpt, getColumn(article.columnId).title, getAuthor(article.authorId).name, ...article.body.map(blockText)].join(" ").toLowerCase().includes(searchTerm)),
        columns: columns.filter((column) => [column.title, column.description, getAuthor(column.authorId).name].join(" ").toLowerCase().includes(searchTerm)),
        authors: authors.filter((author) => [author.name, author.role, author.bio].join(" ").toLowerCase().includes(searchTerm)),
      }
    : null;

  return (
    <>
      <section className="home-intro content-width">
        <div><h1>{author ? author.name : "公开写作与教程"}</h1><p>{author ? author.bio : "站长与受邀作者的公开写作空间。"}</p></div>
        <div className="home-count">{visibleColumns.length} 个专栏 · {filteredArticles.length} 篇文章</div>
      </section>

      {searchResults ? (
        <section className="search-results content-width">
          <div className="section-heading"><div><h2>搜索结果</h2></div><button className="clear-search" onClick={() => onSearch("")}>清除搜索 ×</button></div>
          <p className="search-summary">找到 {searchResults.articles.length + searchResults.columns.length + searchResults.authors.length} 条结果 · “{searchQuery}”</p>
          <div className="search-groups">
            <SearchGroup label="文章" count={searchResults.articles.length}>
              {searchResults.articles.map((article) => <SearchArticle key={article.id} article={article} onOpen={onOpenArticle} />)}
            </SearchGroup>
            <SearchGroup label="专栏" count={searchResults.columns.length}>
              {searchResults.columns.map((column) => <button className="search-column-result" key={column.id} onClick={() => { setActiveColumnId(column.id); onSearch(""); }}>{column.title}<span>{column.description}</span></button>)}
            </SearchGroup>
            <SearchGroup label="作者" count={searchResults.authors.length}>
              {searchResults.authors.map((author) => <a className="search-author-result" href={`/authors/${author.id}`} key={author.id}><span><strong>{author.name}</strong><small>{author.role}</small></span></a>)}
            </SearchGroup>
          </div>
        </section>
      ) : (
        <>
          <section className="content-width latest-section" id="columns">
            <div className="section-heading"><div><h2>专栏</h2></div></div>
            <div className="column-grid">
              {visibleColumns.map((column, index) => <ColumnCard key={column.id} column={column} index={index} selected={activeColumnId === column.id} onSelect={() => setActiveColumnId(activeColumnId === column.id ? null : column.id)} />)}
            </div>
          </section>

          <section className="content-width article-feed">
            <div className="feed-heading"><h2>{activeColumnId ? getColumn(activeColumnId).title : author ? "公开文章" : "最近文章"}</h2><span>{filteredArticles.length} 篇公开文章</span></div>
            <div className="article-list">
              {filteredArticles.map((article, index) => <ArticleRow key={article.id} article={article} index={index} onOpen={onOpenArticle} />)}
            </div>
            {!filteredArticles.length && <div className="empty-state">这个专栏还没有公开文章。</div>}
          </section>

        </>
      )}
    </>
  );
}

function ColumnCard({ column, index, selected, onSelect }: { column: Column; index: number; selected: boolean; onSelect: () => void }) {
  const author = getAuthor(column.authorId);
  return <button className={`column-card ${column.accent} ${selected ? "selected" : ""}`} onClick={onSelect}>
    <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
    <div><h3>{column.title}</h3><p>{column.description}</p></div>
    <div className="card-meta"><span>{author.name}</span><span>{column.count} 篇 · {column.updated}</span></div>
  </button>;
}

function ArticleRow({ article, index, onOpen }: { article: Article; index: number; onOpen: (id: string) => void }) {
  const author = getAuthor(article.authorId);
  const column = getColumn(article.columnId);
  return <button className="article-row" onClick={() => onOpen(article.id)}>
    <span className="article-number">{String(index + 1).padStart(2, "0")}</span>
    <span className="article-main"><span className="article-column">{column.title}</span><strong>{article.title}</strong><span className="article-excerpt">{article.excerpt}</span></span>
    <span className="article-details"><span>{author.name}</span><span>{article.firstPublished}</span></span>
  </button>;
}

function SearchGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return <div className="search-group"><div className="search-group-heading"><span>{label}</span><small>{count}</small></div>{count ? children : <p className="no-results">没有匹配的{label}</p>}</div>;
}

function SearchArticle({ article, onOpen }: { article: Article; onOpen: (id: string) => void }) {
  return <button className="search-article-result" onClick={() => onOpen(article.id)}><span className="section-kicker">{getColumn(article.columnId).title}</span><strong>{article.title}</strong><span>{article.excerpt}</span><small>{getAuthor(article.authorId).name} · {article.firstPublished}</small></button>;
}

function ReaderView({
  article,
  column,
  articles,
  columnQuery,
  setColumnQuery,
  onBack,
  onOpenArticle,
}: {
  article: Article;
  column: Column;
  articles: Article[];
  columnQuery: string;
  setColumnQuery: (value: string) => void;
  onBack: () => void;
  onOpenArticle: (id: string) => void;
}) {
  const [tocOpen, setTocOpen] = useState(false);
  const columnArticles = articles.filter((item) => item.columnId === column.id && item.status === "published");
  const query = columnQuery.trim().toLowerCase();
  const shownArticles = query ? columnArticles.filter((item) => `${item.title} ${item.excerpt} ${getAuthor(item.authorId).name}`.toLowerCase().includes(query)) : columnArticles;
  const headings = article.body.filter((block): block is Extract<Block, { type: "heading" }> => block.type === "heading");

  return <div className="reader-page">
    <header className="reader-toolbar">
      <button className="back-link" onClick={onBack}>← <span>一页</span></button>
      <label className="column-search"><span aria-hidden="true">⌕</span><input value={columnQuery} onChange={(event) => setColumnQuery(event.target.value)} placeholder="搜索当前专栏" aria-label="在本专栏中搜索" /></label>
    </header>
    <div className="reader-layout">
    <aside className={`reader-sidebar ${tocOpen ? "open" : ""}`}>
      <div className="sidebar-top"><span>文章</span><button className="close-sidebar" onClick={() => setTocOpen(false)} aria-label="关闭目录">×</button></div>
      <div className="sidebar-column"><span className={`column-dot ${column.accent}`} /> <span>{column.title}</span><span className="sidebar-count">{columnArticles.length}</span></div>
      <div className="reader-article-list">{shownArticles.map((item, index) => <button className={`reader-article-link ${item.id === article.id ? "current" : ""}`} key={item.id} onClick={() => { onOpenArticle(item.id); setTocOpen(false); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong><small>{item.readTime}</small></button>)}{!shownArticles.length && <p className="no-results">专栏内没有匹配文章</p>}</div>
    </aside>
    <div className="reader-main">
      <div className="reader-mobile-bar"><button onClick={() => setTocOpen(true)}>☰ <span>文章目录</span></button><button onClick={onBack}>返回首页</button></div>
      <article className="reading-column">
        <div className="reading-meta"><span>{column.title}</span><span>首次发布于 {article.firstPublished}</span><span>最后更新于 {article.updated}</span></div>
        <h1>{article.title}</h1>
        <div className="reading-byline"><a href={`/authors/${article.authorId}`}>{getAuthor(article.authorId).name}</a></div>
        <div className="article-body"><ArticleBody blocks={article.body} /></div>
      </article>
      <aside className="reading-toc"><span className="toc-label">目录</span>{headings.map((heading, index) => <a href={`#${heading.id}`} key={heading.id}><span>0{index + 1}</span>{heading.text}</a>)}</aside>
    </div></div>
  </div>;
}

function InlineText({ text }: { text: string }) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return <>{tokens.map((token, index) => {
    if (/^`[^`]+`$/.test(token)) return <code key={index}>{token.slice(1, -1)}</code>;
    if (/^\*\*[^*]+\*\*$/.test(token)) return <strong key={index}>{token.slice(2, -2)}</strong>;
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={index} href={link[2]} rel="noreferrer">{link[1]}</a>;
    return token;
  })}</>;
}

function ArticleBody({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map((block, index) => {
    if (block.type === "heading") return <h2 id={block.id} key={`${block.type}-${index}`}><InlineText text={block.text} /></h2>;
    if (block.type === "paragraph") return <p key={`${block.type}-${index}`}><InlineText text={block.text} /></p>;
    if (block.type === "quote") return <blockquote key={`${block.type}-${index}`}><p><InlineText text={block.text} /></p>{block.cite && <cite>{block.cite}</cite>}</blockquote>;
    if (block.type === "code") return <pre key={`${block.type}-${index}`}><code><span className="code-language">{block.language}</span>{block.text}</code></pre>;
    if (block.type === "list") return <ul key={`${block.type}-${index}`}>{block.items.map((item) => <li key={item}><InlineText text={item} /></li>)}</ul>;
    if (block.type === "image") return <figure key={`${block.type}-${index}`}><img src={block.src} alt={block.alt} loading="lazy" />{block.alt && <figcaption>{block.alt}</figcaption>}</figure>;
    if (block.type === "table") return <div className="table-scroll" key={`${block.type}-${index}`}><table><thead><tr>{block.headers.map((cell) => <th key={cell}><InlineText text={cell} /></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><InlineText text={cell} /></td>)}</tr>)}</tbody></table></div>;
    return <div className="article-callout" key={`${block.type}-${index}`}><strong>{block.title}</strong><p>{block.text}</p></div>;
  })}</>;
}

type StudioPanel = "articles" | "columns" | "members";

function StudioView({
  articles,
  onBack,
  onPublish,
  onNotice,
}: {
  articles: Article[];
  onBack: () => void;
  onPublish: (article: Article) => void;
  onNotice: (notice: string) => void;
}) {
  const [panel, setPanel] = useState<StudioPanel>("articles");
  const [studioColumns, setStudioColumns] = useState<Column[]>(columns);
  const [studioArticles, setStudioArticles] = useState<Article[]>(articles);
  const [selectedColumnId, setSelectedColumnId] = useState(columns[0].id);
  const [members, setMembers] = useState<Member[]>(memberDirectory);
  const [memberMap, setMemberMap] = useState<Record<string, string[]>>({
    "column-systems": ["author-lin"],
    "column-presence": ["author-sun"],
    "column-reading": [],
  });
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => response.ok ? (await response.json()).user as SessionUser : null)
      .then((user) => { if (active && user) setCurrentUser(user); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    Promise.all([
      fetch("/api/columns?scope=managed&includeDeleted=1").then((response) => response.ok ? response.json() : Promise.reject(new Error("columns"))),
      fetch("/api/articles?scope=managed&includeDeleted=1").then((response) => response.ok ? response.json() : Promise.reject(new Error("articles"))),
    ]).then(([columnData, articleData]) => {
      if (!active) return;
      const nextColumns = (columnData.columns as ApiColumn[]).map(apiColumnToColumn);
      const nextArticles = (articleData.articles as (ApiArticle & { status: "draft" | "published" | "deleted" })[]).map(apiArticleToArticle);
      if (nextColumns.length) {
        setStudioColumns(nextColumns);
        setSelectedColumnId(nextColumns[0].id);
      }
      setStudioArticles(nextArticles);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [currentUser]);

  const createColumn = async () => {
    if (currentUser) {
      const response = await fetch("/api/columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "未命名专栏", description: "" }) });
      if (!response.ok) { onNotice("专栏创建失败"); return; }
      const data = await response.json() as { column: ApiColumn };
      const next = apiColumnToColumn(data.column);
      setStudioColumns((current) => [...current, next]);
      setMemberMap((current) => ({ ...current, [next.id]: [] }));
      setSelectedColumnId(next.id);
      setPanel("columns");
      onNotice("已创建专栏草稿");
      return;
    }
    onNotice("请先登录后台");
  };

  const createArticle = async () => {
    if (currentUser) {
      const response = await fetch("/api/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ columnId: selectedColumnId, title: "未命名文章", bodyMarkdown: "", status: "draft" }) });
      if (!response.ok) { onNotice("文章创建失败"); return; }
      const data = await response.json() as { article: ApiArticle };
      setStudioArticles((current) => [...current, apiArticleToArticle(data.article)]);
      setPanel("articles");
      onNotice("已创建草稿");
      return;
    }
    onNotice("请先登录后台");
  };

  const updateColumn = (next: Column) => {
    setStudioColumns((current) => current.map((column) => column.id === next.id ? next : column));
  };

  const updateArticle = (next: Article) => {
    setStudioArticles((current) => current.map((article) => article.id === next.id ? next : article));
    onPublish(next);
  };

  const panelTitle = panel === "articles" ? "文章" : panel === "columns" ? "专栏" : "成员与权限";

  return (
    <div className="studio-page">
      <div className="studio-topbar">
        <button className="studio-back" onClick={onBack}>← <span>返回公开站点</span></button>
        <div className="studio-title"><span className="studio-mark">一</span><b>后台</b></div>
        <div className="studio-user"><span className="avatar avatar-small" style={{ background: members[0].color }}>{members[0].initials}</span><span>{currentUser?.displayName ?? members[0].name}</span>{!currentUser && <button className="studio-login-link" onClick={() => setShowLogin(true)}>登录</button>}</div>
      </div>
      {showLogin && <StudioLogin onSuccess={(user) => { setCurrentUser(user); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
      <div className="studio-layout">
        <aside className="studio-nav">
          <div className="studio-nav-section">
            <button className={"nav-item " + (panel === "articles" ? "active" : "")} onClick={() => setPanel("articles")}>文章 <small>{studioArticles.length}</small></button>
            <button className={"nav-item " + (panel === "columns" ? "active" : "")} onClick={() => setPanel("columns")}>专栏 <small>{studioColumns.filter((column) => !column.deleted).length}</small></button>
            <button className={"nav-item " + (panel === "members" ? "active" : "")} onClick={() => setPanel("members")}>成员</button>
          </div>
        </aside>
        <section className="studio-content">
          <div className="studio-content-head">
            <div><h1>{panelTitle}</h1></div>
            {panel === "articles" && <button className="button button-dark button-new" onClick={createArticle}>＋ 新建文章</button>}
            {panel === "columns" && <button className="button button-dark button-new" onClick={createColumn}>＋ 新建专栏</button>}
          </div>
          {panel === "articles" && <ArticleEditor articles={studioArticles} columnList={studioColumns} onPublish={updateArticle} onNotice={onNotice} />}
          {panel === "columns" && <ColumnManager key={selectedColumnId} columns={studioColumns} articles={studioArticles} selectedColumnId={selectedColumnId} memberMap={memberMap} onSelect={setSelectedColumnId} onUpdateColumn={updateColumn} onNotice={onNotice} />}
          {panel === "members" && <MemberManager columns={studioColumns} members={members} setMembers={setMembers} memberMap={memberMap} setMemberMap={setMemberMap} selectedColumnId={selectedColumnId} onSelectColumn={setSelectedColumnId} onNotice={onNotice} />}
        </section>
      </div>
    </div>
  );
}

function StudioLogin({ onSuccess, onClose }: { onSuccess: (user: SessionUser) => void; onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json() as { error?: string; user?: SessionUser; mustChangePassword?: boolean };
    if (!response.ok || !data.user) { setError(data.error ?? "登录失败"); return; }
    if (data.mustChangePassword) setPending(data.user); else onSuccess(data.user);
  };
  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: password, newPassword }) });
    const data = await response.json() as { error?: string };
    if (!response.ok || !pending) { setError(data.error ?? "密码修改失败"); return; }
    onSuccess({ ...pending, mustChangePassword: false });
  };
  return <div className="studio-login" role="dialog" aria-modal="true" aria-label="后台登录"><div className="studio-login-panel"><button className="studio-login-close" type="button" onClick={onClose} aria-label="关闭">×</button>{pending ? <form onSubmit={submitPassword}><h2>修改初始密码</h2><label>新密码<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></label><button className="button button-dark" type="submit">保存</button></form> : <form onSubmit={submitLogin}><h2>后台登录</h2><label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="button button-dark" type="submit">登录</button></form>}{error && <p className="studio-login-error" role="alert">{error}</p>}</div></div>;
}

function ArticleEditor({ articles, columnList, onPublish, onNotice }: { articles: Article[]; columnList: Column[]; onPublish: (article: Article) => void; onNotice: (notice: string) => void }) {
  const [selectedId, setSelectedId] = useState(articles[0]?.id ?? "");
  const selected = articles.find((article) => article.id === selectedId) ?? articles[0];
  const [title, setTitle] = useState(selected?.title ?? "");
  const [body, setBody] = useState(selected ? selected.bodyMarkdown ?? blocksToMarkdown(selected.body) : "");
  const [mode, setMode] = useState<"write" | "preview">("preview");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const [conflict, setConflict] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const columnFor = (id: string) => columnList.find((column) => column.id === id) ?? getColumn(id);
  const saveSequence = useRef(0);
  const lastSavedContent = useRef("");
  const onPublishRef = useRef(onPublish);
  const selectedArticleId = selected?.id;
  const selectedVersion = selected?.version;
  const selectedStatus = selected?.status;
  useEffect(() => { onPublishRef.current = onPublish; }, [onPublish]);

  useEffect(() => {
    if (!selectedArticleId || !selectedStatus || selectedStatus === "deleted") return;
    const contentKey = `${selectedArticleId}|${title}|${body}|${selectedStatus}`;
    if (lastSavedContent.current === contentKey) { setSaveState("saved"); return; }
    const sequence = saveSequence.current + 1;
    saveSequence.current = sequence;
    setSaveState("saving");
    const saveTimer = window.setTimeout(async () => {
      if (selectedVersion === undefined) { setSaveState("saved"); return; }
      const response = await fetch(`/api/articles/${selectedArticleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: selectedVersion, title, bodyMarkdown: body, status: selectedStatus }) });
      if (sequence !== saveSequence.current) return;
      if (response.status === 409) { setConflict(true); setSaveState("failed"); return; }
      if (!response.ok) { setSaveState("failed"); return; }
      const data = await response.json() as { article: ApiArticle };
      lastSavedContent.current = contentKey;
      onPublishRef.current(apiArticleToArticle(data.article));
      setSaveState("saved");
    }, 700);
    return () => window.clearTimeout(saveTimer);
  }, [body, selectedArticleId, selectedStatus, selectedVersion, title]);

  useEffect(() => {
    if (saveState !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const selectArticle = (article: Article) => {
    setSelectedId(article.id);
    setTitle(article.title);
    setBody(article.bodyMarkdown ?? blocksToMarkdown(article.body));
    setConflict(false);
    setMode("preview");
    setShowHistory(false);
  };

  const handleImageFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setSaveState("failed");
      onNotice("图片需为 JPG、PNG、WebP 或 GIF，且不超过 10 MB");
      return;
    }
    let imageUrl = "media/" + file.name;
    if (selected?.version !== undefined) {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/media", { method: "POST", body: form });
      if (!response.ok) { setSaveState("failed"); onNotice("图片上传失败"); return; }
      const data = await response.json() as { url: string };
      imageUrl = data.url;
    }
    setBody((current) => current + "\n\n![" + file.name + "](" + imageUrl + ")");
    onNotice("图片已加入文章草稿");
  }, [onNotice, selected?.version]);

  const handleImage = (event: ChangeEvent<HTMLInputElement>) => handleImageFile(event.target.files?.[0]);
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const image = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"))?.getAsFile();
    if (!image) return;
    event.preventDefault();
    handleImageFile(image);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleImageFile(event.dataTransfer.files?.[0]);
  };

  const toggleHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    setShowHistory(true);
    if (!selected || selected.version === undefined) { setVersions([]); return; }
    const response = await fetch(`/api/articles/${selected.id}/versions`);
    if (!response.ok) { setVersions([]); return; }
    const data = await response.json() as { versions: ApiVersion[] };
    setVersions(data.versions);
  };

  const restoreVersion = async (version: ApiVersion) => {
    if (!selected || selected.version === undefined) return;
    const response = await fetch(`/api/articles/${selected.id}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: version.version, currentVersion: selected.version }) });
    if (response.status === 409) { setConflict(true); setShowHistory(false); return; }
    if (!response.ok) { onNotice("版本恢复失败"); return; }
    const data = await response.json() as { article: ApiArticle };
    const restored = apiArticleToArticle(data.article);
    setTitle(restored.title);
    setBody(data.article.bodyMarkdown);
    onPublish(restored);
    setShowHistory(false);
    setMode("preview");
    onNotice("版本已恢复");
  };

  const handlePublish = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || conflict) return;
    if (selected.version === undefined) { onPublish({ ...selected, title, status: "published", updated: "刚刚", body: parseMarkdown(body), bodyMarkdown: body }); return; }
    const response = await fetch(`/api/articles/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: selected.version, title, bodyMarkdown: body, status: "published" }) });
    if (response.status === 409) { setConflict(true); setSaveState("failed"); return; }
    if (!response.ok) { setSaveState("failed"); return; }
    const data = await response.json() as { article: ApiArticle };
    onPublish(apiArticleToArticle(data.article));
    setSaveState("saved");
  };

  const toggleDeleted = async () => {
    if (!selected || selected.version === undefined) { onNotice("请先登录后台"); return; }
    if (selected.status === "deleted") {
      const response = await fetch(`/api/articles/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: selected.version, action: "restore", status: "draft" }) });
      if (response.status === 409) { setConflict(true); return; }
      if (!response.ok) { onNotice("文章恢复失败"); return; }
      const data = await response.json() as { article: ApiArticle };
      onPublish(apiArticleToArticle(data.article));
      onNotice("文章已恢复为草稿");
      return;
    }
    const response = await fetch(`/api/articles/${selected.id}`, { method: "DELETE" });
    if (!response.ok) { onNotice("文章删除失败"); return; }
    const data = await response.json() as { article: { version: number } };
    onPublish({ ...selected, status: "deleted", version: data.article.version });
    onNotice("文章已停止公开展示");
  };

  if (!selected) return <div className="empty-state">暂无文章</div>;

  return (
    <div className="studio-editor-layout">
      <div className="studio-article-list">
        <div className="list-toolbar"><span>文章</span></div>
        {articles.map((article) => <button className={"studio-article-item " + (article.id === selected.id ? "selected" : "")} key={article.id} onClick={() => selectArticle(article)}><span className={"status-dot " + article.status} /><span><strong>{article.title}</strong><small>{columnFor(article.columnId).title} · {article.updated}</small></span></button>)}
      </div>
      <form className="editor-panel" onSubmit={handlePublish}>
        <div className="editor-toolbar">
          <div className="editor-status"><span className={"save-dot " + saveState} />{saveState === "saving" ? "正在保存" : saveState === "failed" ? "保存失败" : "已保存"}</div>
          <div className="editor-actions">
            <label className="icon-button upload-inline">图片<input aria-label="上传图片" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImage} /></label>
            <button type="button" className="icon-button" onClick={toggleHistory} aria-label="查看版本历史">历史</button>
            <button type="button" className="icon-button" onClick={() => setMode((current) => current === "write" ? "preview" : "write")}>{mode === "write" ? "完成" : "编辑"}</button>
            <button type="button" className="icon-button editor-delete" onClick={toggleDeleted}>{selected.status === "deleted" ? "恢复" : "删除"}</button>
            <button type="submit" className="button button-dark publish-button" disabled={Boolean(conflict) || selected.status === "deleted"}>发布</button>
          </div>
        </div>
        {conflict && <div className="conflict-banner" role="alert"><span>!</span><div><strong>检测到内容冲突</strong><p>当前内容已保留，请复制后重新加载最新版。</p></div><button type="button" onClick={() => setConflict(false)}>关闭</button></div>}
        {showHistory && <div className="history-panel"><div><strong>版本历史</strong></div>{versions.map((version) => <button type="button" key={version.version} onClick={() => restoreVersion(version)}>版本 {version.version} · {displayDate(version.createdAt)}</button>)}{!versions.length && <span className="history-empty">暂无版本</span>}</div>}
        <div className="editor-writing" onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
          <label className="sr-only" htmlFor="article-title">文章标题</label>
          <input id="article-title" className="editor-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <div className="editor-meta-row"><span>{columnFor(selected.columnId).title}</span><span>{selected.firstPublished}</span></div>
          {mode === "write" ? <textarea className="editor-textarea" value={body} onChange={(event) => setBody(event.target.value)} onPaste={handlePaste} aria-label="Markdown 文章正文" /> : <div className="editor-preview article-body" onDoubleClick={() => setMode("write")}><ArticleBody blocks={parseMarkdown(body)} /></div>}
        </div>
      </form>
    </div>
  );
}

function ColumnManager({
  columns: columnList,
  articles,
  selectedColumnId,
  memberMap,
  onSelect,
  onUpdateColumn,
  onNotice,
}: {
  columns: Column[];
  articles: Article[];
  selectedColumnId: string;
  memberMap: Record<string, string[]>;
  onSelect: (id: string) => void;
  onUpdateColumn: (column: Column) => void;
  onNotice: (notice: string) => void;
}) {
  const selected = columnList.find((column) => column.id === selectedColumnId) ?? columnList[0];
  const [title, setTitle] = useState(selected.title);
  const [description, setDescription] = useState(selected.description);
  const [order, setOrder] = useState(articles.filter((article) => article.columnId === selected.id).map((article) => article.id));

  const columnArticles = order.map((id) => articles.find((article) => article.id === id)).filter((article): article is Article => Boolean(article));
  const moveArticle = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  };
  const saveColumn = async () => {
    const response = await fetch(`/api/columns/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description }) });
    if (!response.ok) { onNotice("请先登录后台"); return; }
    onUpdateColumn({ ...selected, title, description, updated: selected.updated });
    onNotice("专栏资料已保存");
  };

  const restoreColumn = async () => {
    const response = await fetch(`/api/columns/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore" }) });
    if (!response.ok) { onNotice("专栏恢复失败"); return; }
    onUpdateColumn({ ...selected, deleted: false });
    onNotice("专栏已恢复");
  };

  const deleteColumn = async () => {
    const response = await fetch(`/api/columns/${selected.id}`, { method: "DELETE" });
    if (!response.ok) { onNotice("专栏删除失败"); return; }
    onUpdateColumn({ ...selected, deleted: true });
    onNotice("专栏已软删除");
  };

  const saveOrder = async () => {
    const response = await fetch(`/api/columns/${selected.id}/articles/order`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleIds: order }) });
    if (!response.ok) { onNotice("文章顺序保存失败"); return; }
    onNotice("文章顺序已保存");
  };

  return <div className="column-manager">
    <div className="manager-list">
      <div className="list-toolbar"><span>专栏</span><span>{columnList.filter((column) => !column.deleted).length} 个</span></div>
      {columnList.map((column) => <button type="button" className={"manager-list-item " + (column.id === selected.id ? "selected" : "")} key={column.id} onClick={() => onSelect(column.id)}><span className={"column-dot " + column.accent} /><span><strong>{column.title}</strong><small>{memberMap[column.id]?.length ?? 0} 位协作者 · {column.deleted ? "已删除" : column.count + " 篇文章"}</small></span></button>)}
    </div>
    <div className="manager-detail">
      <div className="manager-form"><label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>简介<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label><div className="manager-actions"><button type="button" className="button button-dark" onClick={saveColumn}>保存专栏</button>{selected.deleted ? <button type="button" className="text-button" onClick={restoreColumn}>恢复</button> : <button type="button" className="text-button danger" onClick={deleteColumn}>删除</button>}</div></div>
      <div className="order-panel"><div className="manager-subhead"><strong>文章顺序</strong><span>首次发布时间 → 可手动调整</span></div>{columnArticles.map((article, index) => <div className="order-row" key={article.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData("text/plain")); moveArticle(from, index); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{article.title}</strong><button type="button" onClick={() => moveArticle(index, index - 1)} aria-label="上移">↑</button><button type="button" onClick={() => moveArticle(index, index + 1)} aria-label="下移">↓</button></div>)}{!columnArticles.length && <p className="no-results">暂无文章</p>}<button type="button" className="text-button order-save" onClick={saveOrder}>保存顺序</button></div>
    </div>
  </div>;
}

function MemberManager({
  columns,
  members,
  setMembers,
  memberMap,
  setMemberMap,
  selectedColumnId,
  onSelectColumn,
  onNotice,
}: {
  columns: Column[];
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  memberMap: Record<string, string[]>;
  setMemberMap: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  selectedColumnId: string;
  onSelectColumn: (id: string) => void;
  onNotice: (notice: string) => void;
}) {
  const selectedColumn = columns.find((column) => column.id === selectedColumnId) ?? columns[0];
  const memberIds = memberMap[selectedColumn.id] ?? [];
  const [inviteId, setInviteId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/columns/${selectedColumn.id}/members`).then(async (response) => response.ok ? response.json() : Promise.reject(new Error("members"))).then((data: { members: Array<{ id: string; username: string; displayName: string; status: "active" | "disabled"; membershipStatus: "active" | "removed"; joinedAt: string }>; availableUsers: Array<{ id: string; username: string; displayName: string; status: "active" | "disabled" }> }) => {
      if (!active) return;
      const available = [...data.members, ...data.availableUsers.filter((user) => !data.members.some((member) => member.id === user.id))];
      const nextMembers = available.map((member, index) => ({ id: member.id, name: member.displayName, username: member.username, role: "作者" as const, status: member.status, joinedAt: displayDate("joinedAt" in member ? (member as { joinedAt?: string }).joinedAt : undefined), articleCount: 0, initials: member.displayName.slice(0, 2), color: ["#1f6f68", "#b36b3f", "#6a5b9b", "#637b8b"][index % 4], mustChangePassword: false }));
      setMembers(nextMembers);
      setMemberMap((current) => ({ ...current, [selectedColumn.id]: data.members.filter((member) => member.membershipStatus === "active").map((member) => member.id) }));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [selectedColumn.id, setMemberMap, setMembers]);
  const invited = members.filter((member) => memberIds.includes(member.id));
  const available = members.filter((member) => member.status === "active" && !memberIds.includes(member.id) && member.id !== selectedColumn.authorId);
  const invite = async () => {
    if (!inviteId) return;
    const response = await fetch(`/api/columns/${selectedColumn.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: inviteId }) });
    if (!response.ok) { onNotice("协作者邀请失败"); return; }
    setMemberMap((current) => ({ ...current, [selectedColumn.id]: [...(current[selectedColumn.id] ?? []), inviteId] }));
    setInviteId("");
    onNotice("协作者已邀请");
  };
  const remove = async (id: string) => {
    const response = await fetch(`/api/columns/${selectedColumn.id}/members`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id }) });
    if (!response.ok) { onNotice("协作者移除失败"); return; }
    setMemberMap((current) => ({ ...current, [selectedColumn.id]: (current[selectedColumn.id] ?? []).filter((memberId) => memberId !== id) }));
    onNotice("协作者已移除，既有文章保留");
  };
  const toggleAccount = async (id: string) => {
    const member = members.find((item) => item.id === id);
    if (!member) return;
    const response = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: member.status === "active" ? "disable" : "enable" }) });
    if (!response.ok) { onNotice("账号状态更新失败"); return; }
    setMembers((current) => current.map((member) => member.id === id ? { ...member, status: member.status === "active" ? "disabled" : "active" } : member));
    onNotice("账号状态已更新");
  };
  const resetPassword = async (id: string) => {
    const response = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset_password" }) });
    if (!response.ok) { onNotice("密码重置失败"); return; }
    const data = await response.json() as { temporaryPassword?: string };
    setMembers((current) => current.map((member) => member.id === id ? { ...member, mustChangePassword: true } : member));
    onNotice(data.temporaryPassword ? `临时密码：${data.temporaryPassword}` : "已重置初始密码");
  };
  const createAccount = async () => {
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: newUsername, displayName: newDisplayName, password: newPassword }) });
    if (!response.ok) { onNotice("作者账号创建失败"); return; }
    const data = await response.json() as { user: { id: string; username: string; displayName: string; status: "active" } };
    setMembers((current) => [...current, { id: data.user.id, name: data.user.displayName, username: data.user.username, role: "作者", status: data.user.status, joinedAt: "—", articleCount: 0, initials: data.user.displayName.slice(0, 2), color: "#637b8b", mustChangePassword: true }]);
    setNewUsername(""); setNewDisplayName(""); setNewPassword("");
    onNotice("作者账号已创建");
  };

  return <div className="member-manager">
    <div className="member-column-head"><label>当前专栏<select value={selectedColumn.id} onChange={(event) => onSelectColumn(event.target.value)}>{columns.filter((column) => !column.deleted).map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select></label><span>{selectedColumn.title}</span></div>
    <div className="member-grid">
      <section className="member-section"><div className="manager-subhead"><strong>协作者</strong><span>{invited.length} 位</span></div><div className="creator-row"><span className="avatar avatar-small" style={{ background: getAuthor(selectedColumn.authorId).color }}>{getAuthor(selectedColumn.authorId).initials}</span><span><strong>{getAuthor(selectedColumn.authorId).name}</strong><small>专栏创建者 · 可管理全部文章</small></span></div>{invited.map((member) => <div className="member-row" key={member.id}><span className="avatar avatar-small" style={{ background: member.color }}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.username} · {member.articleCount} 篇文章</small></span><span className="member-status">协作者</span><button type="button" className="text-button danger" onClick={() => remove(member.id)}>移除</button></div>)}{!invited.length && <p className="no-results">暂无协作者</p>}<div className="invite-row"><select value={inviteId} onChange={(event) => setInviteId(event.target.value)}><option value="">选择启用账号</option>{available.map((member) => <option key={member.id} value={member.id}>{member.name}（{member.username}）</option>)}</select><button type="button" className="button button-dark" onClick={invite} disabled={!inviteId}>邀请</button></div><p className="member-note">移除后既有文章继续公开，但该作者不能再编辑。</p></section>
      <section className="member-section"><div className="manager-subhead"><strong>账号</strong><span>管理员可停用或重置密码</span></div><div className="account-create"><input value={newDisplayName} onChange={(event) => setNewDisplayName(event.target.value)} placeholder="显示名称" aria-label="新作者显示名称" /><input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="用户名" aria-label="新作者用户名" /><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="初始密码" aria-label="新作者初始密码" /><button type="button" className="button button-dark" onClick={createAccount} disabled={!newDisplayName || !newUsername || newPassword.length < 8}>新建作者</button></div>{members.map((member) => <div className="account-row" key={member.id}><span className="avatar avatar-small" style={{ background: member.color }}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.username} · {member.role} · {member.status === "active" ? "启用" : "停用"}</small></span><span className="account-actions">{member.mustChangePassword && <em>首次登录改密</em>}<button type="button" onClick={() => resetPassword(member.id)}>重置密码</button><button type="button" onClick={() => toggleAccount(member.id)} disabled={member.role === "管理员"}>{member.status === "active" ? "停用" : "启用"}</button></span></div>)}</section>
    </div>
  </div>;
}
