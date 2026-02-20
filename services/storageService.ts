import { supabase } from './supabaseClient';
import { Goal, Topic, Exercise, Attempt, ChecklistItem } from '../types';

export const storageService = {
  // Goals
  getGoals: async (): Promise<Goal[]> => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching goals:', error);
      return [];
    }
    
    // Map snake_case from DB to camelCase for app
    return data.map((g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      createdAt: new Date(g.created_at).getTime(),
      totalTopics: g.total_topics,
      totalExercises: g.total_exercises,
      completedExercises: g.completed_exercises
    }));
  },
  
  saveGoal: async (goal: Partial<Goal>) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { error } = await supabase.from('goals').insert({
      id: goal.id, // Optional, let DB gen if undefined
      user_id: user.id,
      title: goal.title,
      description: goal.description,
      total_topics: 0,
      total_exercises: 0,
      completed_exercises: 0
    });

    if (error) console.error('Error saving goal:', error);
  },

  updateGoal: async (goal: Goal) => {
    const { error } = await supabase.from('goals').update({
      title: goal.title,
      description: goal.description,
      total_topics: goal.totalTopics,
      total_exercises: goal.totalExercises,
      completed_exercises: goal.completedExercises
    }).eq('id', goal.id);

    if (error) console.error('Error updating goal:', error);
  },

  deleteGoal: async (id: string) => {
    // RLS and Cascade delete in SQL will handle children
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) console.error('Error deleting goal:', error);
  },

  // Topics
  getTopics: async (goalId?: string): Promise<Topic[]> => {
    let query = supabase.from('topics').select('*');
    if (goalId) query = query.eq('goal_id', goalId);
    
    const { data, error } = await query;
    if (error) return [];

    return data.map((t: any) => ({
      id: t.id,
      goalId: t.goal_id,
      title: t.title,
      description: t.description,
      dueDate: t.due_date ? new Date(t.due_date).getTime() : null
    }));
  },

  saveTopics: async (topics: Topic[]) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const records = topics.map(t => ({
      // id: t.id, // Let DB generate UUID
      user_id: user.id,
      goal_id: t.goalId,
      title: t.title,
      description: t.description,
      due_date: t.dueDate ? new Date(t.dueDate).toISOString() : null
    }));

    const { error } = await supabase.from('topics').insert(records);
    if (error) console.error('Error saving topics:', error);
  },

  deleteTopic: async (id: string) => {
    // Assumes DB Cascade Delete is set up for children (exercises, etc.)
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (error) console.error('Error deleting topic:', error);
  },

  // Checklist Items
  getChecklistItems: async (topicId?: string): Promise<ChecklistItem[]> => {
    let query = supabase.from('checklist_items').select('*').order('created_at', { ascending: true });
    if (topicId) query = query.eq('topic_id', topicId);

    const { data, error } = await query;
    if (error) return [];

    return data.map((c: any) => ({
        id: c.id,
        topicId: c.topic_id,
        goalId: c.goal_id,
        text: c.text,
        isCompleted: c.is_completed,
        dueDate: c.due_date ? new Date(c.due_date).getTime() : null
    }));
  },

  getAllChecklistItems: async (goalId?: string): Promise<ChecklistItem[]> => {
    let query = supabase.from('checklist_items').select('*');
    if (goalId) query = query.eq('goal_id', goalId);

    const { data, error } = await query;
    if (error) return [];

    return data.map((c: any) => ({
        id: c.id,
        topicId: c.topic_id,
        goalId: c.goal_id,
        text: c.text,
        isCompleted: c.is_completed,
        dueDate: c.due_date ? new Date(c.due_date).getTime() : null
    }));
  },

  saveChecklistItem: async (item: Partial<ChecklistItem>) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { error } = await supabase.from('checklist_items').insert({
        user_id: user.id,
        goal_id: item.goalId,
        topic_id: item.topicId,
        text: item.text,
        is_completed: item.isCompleted || false,
        due_date: item.dueDate ? new Date(item.dueDate).toISOString() : null
    });
    
    if (error) console.error('Error saving checklist item:', error);
  },

  toggleChecklistItem: async (id: string, isCompleted: boolean) => {
    const { error } = await supabase.from('checklist_items').update({
        is_completed: isCompleted
    }).eq('id', id);

    if (error) console.error('Error updating checklist item:', error);
  },

  deleteChecklistItem: async (id: string) => {
    const { error } = await supabase.from('checklist_items').delete().eq('id', id);
    if (error) console.error('Error deleting checklist item:', error);
  },

  // Exercises
  getExercises: async (topicId?: string): Promise<Exercise[]> => {
    let query = supabase.from('exercises').select('*');
    if (topicId) query = query.eq('topic_id', topicId);
    
    const { data, error } = await query;
    if (error) return [];

    return data.map((e: any) => ({
      id: e.id,
      topicId: e.topic_id,
      goalId: e.goal_id,
      location: e.location,
      status: e.status,
      lastAttemptedAt: e.last_attempted_at ? Number(e.last_attempted_at) : null,
      nextReviewAt: e.next_review_at ? Number(e.next_review_at) : null,
      consecutiveSuccesses: e.consecutive_successes,
      dueDate: e.due_date ? new Date(e.due_date).getTime() : null
    }));
  },

  getAllExercises: async (goalId?: string): Promise<Exercise[]> => {
    let query = supabase.from('exercises').select('*');
    if (goalId) query = query.eq('goal_id', goalId);

    const { data, error } = await query;
    if (error) return [];

    return data.map((e: any) => ({
      id: e.id,
      topicId: e.topic_id,
      goalId: e.goal_id,
      location: e.location,
      status: e.status,
      lastAttemptedAt: e.last_attempted_at ? Number(e.last_attempted_at) : null,
      nextReviewAt: e.next_review_at ? Number(e.next_review_at) : null,
      consecutiveSuccesses: e.consecutive_successes,
      dueDate: e.due_date ? new Date(e.due_date).getTime() : null
    }));
  },

  saveExercises: async (exercises: Exercise[]) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const records = exercises.map(e => ({
      // id: e.id, // Let DB generate
      user_id: user.id,
      goal_id: e.goalId,
      topic_id: e.topicId,
      location: e.location,
      status: 'new',
      consecutive_successes: 0,
      due_date: e.dueDate ? new Date(e.dueDate).toISOString() : null
    }));

    const { error } = await supabase.from('exercises').insert(records);
    if (error) console.error('Error saving exercises:', error);
  },

  updateExercise: async (e: Exercise) => {
    const { error } = await supabase.from('exercises').update({
      status: e.status,
      last_attempted_at: e.lastAttemptedAt,
      next_review_at: e.nextReviewAt,
      consecutive_successes: e.consecutiveSuccesses
    }).eq('id', e.id);

    if (error) console.error('Error updating exercise:', error);
  },

  deleteExercise: async (id: string) => {
    const response = await supabase.from('exercises').delete().eq('id', id);
    if (response.error) console.error('Error deleting exercise:', response.error);
    return response;
  },

  // Attempts
  logAttempt: async (attempt: Attempt) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { error } = await supabase.from('attempts').insert({
      user_id: user.id,
      exercise_id: attempt.exerciseId,
      result: attempt.result,
      timestamp: attempt.timestamp
    });

    if (error) console.error('Error logging attempt:', error);
  },

  // Logic for Spaced Repetition Query
  getReviewQueue: async (): Promise<Exercise[]> => {
    const allExercises = await storageService.getAllExercises();
    const now = Date.now();

    return allExercises.filter(ex => {
      // 1. New exercises (Gray) are NOT automatically in review queue.
      // They must be attempted once manually to enter the cycle.
      if (ex.status === 'new') return false;

      // 2. If status is 'red' (failed), review after 24 hours from last attempt
      if (ex.status === 'red') {
        if (!ex.lastAttemptedAt) return true; // Should not happen if red, but fallback
        const oneDayMs = 24 * 60 * 60 * 1000;
        return (now - ex.lastAttemptedAt) >= oneDayMs;
      }

      // 3. If status is 'green' (success), respect the nextReviewAt
      if (ex.status === 'green' && ex.nextReviewAt) {
        return now >= ex.nextReviewAt;
      }

      return false;
    });
  }
};