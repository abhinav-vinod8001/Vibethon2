import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  targetRole: text("target_role").notNull(),
  language: text("language").notNull(),
  experience: text("experience").notNull(),
  skills: text("skills").notNull(),
  availability: text("availability").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location").notNull(),
    category: text("category").notNull(),
    type: text("type").notNull(),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    description: text("description").notNull(),
    requirements: text("requirements").notNull(),
    shift: text("shift").notNull(),
    deadline: text("deadline").notNull(),
    status: text("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    embedding: text("embedding"),
    embeddingModel: text("embedding_model"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("jobs_owner_idx").on(table.ownerId)],
);
export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    candidateId: text("candidate_id").notNull(),
    snapshot: text("snapshot").notNull(),
    jobVersion: integer("job_version").notNull(),
    status: text("status").notNull().default("submitted"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("application_candidate_job").on(table.jobId, table.candidateId),
    index("application_candidate_idx").on(table.candidateId),
  ],
);
