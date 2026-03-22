import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  firstMessage: text("first_message"),
  systemPrompt: text("system_prompt"),
  background: text("background"),
  moodTags: jsonb("mood_tags").default(["Ngọt", "Ngược", "Lạnh lùng"]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  characterId: serial("character_id").references(() => characters.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCharacterSchema = createInsertSchema(characters);
export const selectCharacterSchema = createSelectSchema(characters);
