import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  json,
  real,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  name: text('name'),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

// Flows table
export const flows = pgTable('flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_flows_created_at').on(table.createdAt),
]);

// Prompts table
export const prompts = pgTable('prompts', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }),
  type: text('type').default('Prompt'),
  action: text('action'),
  endpointType: text('endpoint_type').default('Chat').notNull(),
  selectedProvider: text('selected_provider').default('OpenAI').notNull(),
  selectedModel: text('selected_model').default('gpt-4o').notNull(),
  systemPrompt: text('system_prompt'),
  tools: json('tools').default([]),
  backgroundPrompt: text('background_prompt'),
  foregroundPrompt: text('foreground_prompt'),
  negativePrompt: text('negative_prompt'),
  preserveOriginalSubject: real('preserve_original_subject'),
  originalBackgroundDepth: real('original_background_depth'),
  keepOriginalBackground: boolean('keep_original_background').default(false),
  lightSourceDirection: text('light_source_direction'),
  lightSourceStrength: real('light_source_strength'),
  seed: real('seed'),
  outputFormat: text('output_format'),
  size: text('size'),
  quality: text('quality'),
  subjectImageUrl: text('subject_image_url'),
  backgroundReferenceUrl: text('background_reference_url'),
  attachmentUrls: json('attachment_urls').default([]),
  position: integer('position').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_prompts_flow_id').on(table.flowId),
  index('idx_prompts_position').on(table.flowId, table.position),
]);

// Runs table
export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowId: uuid('flow_id').references(() => flows.id),
  conversationId: uuid('conversation_id'),
  status: text('status').default('pending'),
  message: text('message'),
  inputImageUrl: text('input_image_url'),
  webhookUrl: text('webhook_url'),
  variables: json('variables').default({}),
  attachmentUrls: json('attachment_urls').default([]),
  data: json('data').default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  sourceRunId: uuid('source_run_id'),
}, (table) => [
  index('idx_runs_flow_id').on(table.flowId),
  index('idx_runs_status').on(table.status),
  index('idx_runs_created_at').on(table.createdAt),
]);

// Relations
export const flowsRelations = relations(flows, ({ many }) => ({
  prompts: many(prompts),
  runs: many(runs),
}));

export const promptsRelations = relations(prompts, ({ one }) => ({
  flow: one(flows, {
    fields: [prompts.flowId],
    references: [flows.id],
  }),
}));

export const runsRelations = relations(runs, ({ one }) => ({
  flow: one(flows, {
    fields: [runs.flowId],
    references: [flows.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Flow = typeof flows.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type Run = typeof runs.$inferSelect;
