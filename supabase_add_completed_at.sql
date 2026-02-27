-- Run this in your Supabase SQL Editor to add the completed_at column

-- Add completed_at to checklist_items (bigint timestamp, same format as attempts.timestamp)
ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS completed_at bigint;
