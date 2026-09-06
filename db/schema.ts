import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  signature: text("signature"),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["owner", "author"] }).notNull().default("author"),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  passwordChangedAt: text("password_changed_at"),
  lastLoginAt: text("last_login_at"),
  ...timestamps,
});

export const columns = sqliteTable("columns", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  creatorId: text("creator_id").notNull().references(() => users.id),
  latestPublishedAt: text("latest_published_at"),
  deletedAt: text("deleted_at"),
  ...timestamps,
});

export const columnMembers = sqliteTable("column_members", {
  columnId: text("column_id").notNull().references(() => columns.id),
  userId: text("user_id").notNull().references(() => users.id),
  invitedBy: text("invited_by").notNull().references(() => users.id),
  status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
  joinedAt: text("joined_at").notNull(),
  removedAt: text("removed_at"),
  removedBy: text("removed_by").references(() => users.id),
}, (table) => ({
  primaryKey: primaryKey({ columns: [table.columnId, table.userId] }),
}));

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  columnId: text("column_id").notNull().references(() => columns.id),
  authorId: text("author_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  bodyMarkdown: text("body_markdown").notNull().default(""),
  draftTitle: text("draft_title"),
  draftBodyMarkdown: text("draft_body_markdown"),
  status: text("status", { enum: ["draft", "published", "deleted"] }).notNull().default("draft"),
  firstPublishedAt: text("first_published_at"),
  lastPublishedAt: text("last_published_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedBy: text("deleted_by").references(() => users.id),
  deletedAt: text("deleted_at"),
  version: integer("version").notNull().default(1),
  ...timestamps,
});

export const articleVersions = sqliteTable("article_versions", {
  id: text("id").primaryKey(),
  articleId: text("article_id").notNull().references(() => articles.id),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  savedBy: text("saved_by").notNull().references(() => users.id),
  kind: text("kind", { enum: ["autosave", "publish", "delete"] }).notNull().default("autosave"),
  createdAt: text("created_at").notNull(),
});

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  storageKey: text("storage_key").notNull().unique(),
  displayKey: text("display_key").notNull().unique(),
  avifKey: text("avif_key").unique(),
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const slugHistory = sqliteTable("slug_history", {
  id: text("id").primaryKey(),
  resourceType: text("resource_type", { enum: ["article", "column", "author"] }).notNull(),
  resourceId: text("resource_id").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
});
