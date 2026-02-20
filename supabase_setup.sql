-- Run this in your Supabase SQL Editor to create the missing tables

-- 1. Checklist Items Table
create table if not exists checklist_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  goal_id uuid references goals on delete cascade not null,
  topic_id uuid references topics on delete cascade not null,
  text text not null,
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for checklist_items
alter table checklist_items enable row level security;

-- Policies for checklist_items
create policy "Users can view their own checklist items"
  on checklist_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own checklist items"
  on checklist_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own checklist items"
  on checklist_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own checklist items"
  on checklist_items for delete
  using (auth.uid() = user_id);


-- 2. Attempts Table (If missing)
create table if not exists attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  exercise_id uuid references exercises on delete cascade not null,
  result text not null check (result in ('success', 'failure')),
  timestamp bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for attempts
alter table attempts enable row level security;

-- Policies for attempts
create policy "Users can view their own attempts"
  on attempts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own attempts"
  on attempts for insert
  with check (auth.uid() = user_id);
