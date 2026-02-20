-- Run this in your Supabase SQL Editor to add the due_date columns

-- Add due_date to topics
alter table topics add column if not exists due_date timestamp with time zone;

-- Add due_date to exercises
alter table exercises add column if not exists due_date timestamp with time zone;

-- Add due_date to checklist_items
alter table checklist_items add column if not exists due_date timestamp with time zone;
