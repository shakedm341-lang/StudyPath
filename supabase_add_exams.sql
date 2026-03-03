-- 1. Create Exams Table
create table if not exists exams (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  goal_id uuid references goals on delete cascade not null,
  title text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table exams enable row level security;

create policy "Users can view their own exams"
  on exams for select
  using (auth.uid() = user_id);

create policy "Users can insert their own exams"
  on exams for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own exams"
  on exams for update
  using (auth.uid() = user_id);

create policy "Users can delete their own exams"
  on exams for delete
  using (auth.uid() = user_id);


-- 2. Create Exercise Topics Junction Table
create table if not exists exercise_topics (
  exercise_id uuid references exercises on delete cascade not null,
  topic_id uuid references topics on delete cascade not null,
  primary key (exercise_id, topic_id)
);

alter table exercise_topics enable row level security;

-- Policies for junction table usually follow the exercise/topic owners. Since both belong to user_id, we can join or assume application level checks.
-- For simplicity, let's allow all authenticated users (RLS on exercises/topics already protects the actual rows, but for junction tables we often need explicit policies).
-- A safer approach for junction:
create policy "Users can view their exercise_topics"
  on exercise_topics for select
  using ( exists (select 1 from exercises where id = exercise_topics.exercise_id and user_id = auth.uid()) );

create policy "Users can insert their exercise_topics"
  on exercise_topics for insert
  with check ( exists (select 1 from exercises where id = exercise_id and user_id = auth.uid()) );

create policy "Users can delete their exercise_topics"
  on exercise_topics for delete
  using ( exists (select 1 from exercises where id = exercise_id and user_id = auth.uid()) );


-- 3. Update Exercises Table
alter table exercises add column if not exists exam_id uuid references exams on delete cascade;

-- 4. Migration: Move existing data from exercises.topic_id to exercise_topics
insert into exercise_topics (exercise_id, topic_id)
select id, topic_id 
from exercises 
where topic_id is not null
on conflict do nothing;

-- 5. Drop the old column from exercises table (WARNING: MAKE SURE ALL YOUR TS QUERIES ARE UPDATED FIRST!)
-- We will comment this out for now until the frontend code is updated to prevent breaking the app.
-- alter table exercises drop column topic_id;
