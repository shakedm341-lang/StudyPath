-- Add DELETE policy for attempts table
-- Run this in your Supabase SQL Editor

create policy "Users can delete their own attempts"
  on attempts for delete
  using (auth.uid() = user_id);
