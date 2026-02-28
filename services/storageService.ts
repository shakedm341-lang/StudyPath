import { supabase } from './supabaseClient';
import { Goal, Topic, Exercise, Attempt, ChecklistItem, DailyStats, ActivityFeedItem } from '../types';
import { computeNextReviewDay } from '../utils/dateUtils';

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

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

  deleteTopics: async (ids: string[]) => {
    if (!ids || ids.length === 0) return { data: null, error: null };
    const response = await supabase.from('topics').delete().in('id', ids);
    if (response.error) console.error('Error deleting topics:', response.error);
    return response;
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
      dueDate: c.due_date ? new Date(c.due_date).getTime() : null,
      completedAt: c.completed_at ? Number(c.completed_at) : null
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
      dueDate: c.due_date ? new Date(c.due_date).getTime() : null,
      completedAt: c.completed_at ? Number(c.completed_at) : null
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
      is_completed: isCompleted,
      completed_at: isCompleted ? Date.now() : null
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

  deleteExercises: async (ids: string[]) => {
    if (!ids || ids.length === 0) return { data: null, error: null };
    const response = await supabase.from('exercises').delete().in('id', ids);
    if (response.error) console.error('Error deleting exercises:', response.error);
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
      // App behavior: green = done (never scheduled again). Only red items come back.
      if (ex.status !== 'red') return false;

      const dueAt =
        ex.nextReviewAt ??
        (ex.lastAttemptedAt ? computeNextReviewDay(ex.lastAttemptedAt) : null);

      // Shouldn't happen, but if we have a red item without timestamps, surface it.
      if (!dueAt) return true;

      return now >= dueAt;
    });
  },

  // --- Daily Statistics ---

  getAttemptsByDateRange: async (from: number, to: number): Promise<Attempt[]> => {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .gte('timestamp', from)
      .lte('timestamp', to)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching attempts:', error);
      return [];
    }

    return data.map((a: any) => ({
      id: a.id,
      exerciseId: a.exercise_id,
      result: a.result,
      timestamp: Number(a.timestamp)
    }));
  },

  getCompletedChecklistByDateRange: async (from: number, to: number): Promise<ChecklistItem[]> => {
    const { data, error } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('is_completed', true)
      .gte('completed_at', from)
      .lte('completed_at', to)
      .order('completed_at', { ascending: true });

    if (error) {
      console.error('Error fetching completed checklist items:', error);
      return [];
    }

    return data.map((c: any) => ({
      id: c.id,
      topicId: c.topic_id,
      goalId: c.goal_id,
      text: c.text,
      isCompleted: c.is_completed,
      dueDate: c.due_date ? new Date(c.due_date).getTime() : null,
      completedAt: c.completed_at ? Number(c.completed_at) : null
    }));
  },

  getDailyStats: async (dateTs: number): Promise<DailyStats> => {
    const dayStart = startOfDay(dateTs);
    const dayEnd = endOfDay(dateTs);

    const [attempts, completedChecklist] = await Promise.all([
      storageService.getAttemptsByDateRange(dayStart, dayEnd),
      storageService.getCompletedChecklistByDateRange(dayStart, dayEnd)
    ]);

    const succeeded = attempts.filter(a => a.result === 'success').length;
    const failed = attempts.filter(a => a.result === 'failure').length;

    return {
      date: dayStart,
      exercisesReviewed: attempts.length,
      exercisesSucceeded: succeeded,
      exercisesFailed: failed,
      checklistCompleted: completedChecklist.length,
      totalActivity: attempts.length + completedChecklist.length
    };
  },

  getWeeklyStats: async (): Promise<DailyStats[]> => {
    const now = Date.now();
    const promises: Promise<DailyStats>[] = [];

    // Queue up the 7 days of requests to run concurrently
    for (let i = 6; i >= 0; i--) {
      const dayTs = now - i * 24 * 60 * 60 * 1000;
      promises.push(storageService.getDailyStats(dayTs));
    }

    // Wait for all 7 days to finish simultaneously
    const stats = await Promise.all(promises);
    return stats;
  },

  getActivityFeed: async (dateTs: number): Promise<ActivityFeedItem[]> => {
    const dayStart = startOfDay(dateTs);
    const dayEnd = endOfDay(dateTs);

    const [attempts, completedChecklist] = await Promise.all([
      storageService.getAttemptsByDateRange(dayStart, dayEnd),
      storageService.getCompletedChecklistByDateRange(dayStart, dayEnd)
    ]);

    // We need exercise locations for display
    const exerciseIds = [...new Set(attempts.map(a => a.exerciseId))];
    let exerciseMap = new Map<string, string>();

    if (exerciseIds.length > 0) {
      const { data } = await supabase
        .from('exercises')
        .select('id, location')
        .in('id', exerciseIds);

      if (data) {
        data.forEach((e: any) => {
          const loc = e.location.includes('::')
            ? e.location.split('::').join(': ')
            : e.location;
          exerciseMap.set(e.id, loc);
        });
      }
    }

    const feed: ActivityFeedItem[] = [];

    for (const a of attempts) {
      const location = exerciseMap.get(a.exerciseId) || 'תרגיל';
      feed.push({
        id: a.id,
        type: 'attempt',
        timestamp: a.timestamp,
        description: location,
        result: a.result
      });
    }

    for (const c of completedChecklist) {
      feed.push({
        id: c.id,
        type: 'checklist',
        timestamp: c.completedAt || dayStart,
        description: c.text
      });
    }

    // Sort by timestamp descending (most recent first)
    feed.sort((a, b) => b.timestamp - a.timestamp);

    return feed;
  },

  getStudyStreak: async (): Promise<{ current: number; longest: number }> => {
    // Fetch all attempts ordered by timestamp
    const { data: attemptData, error: attemptError } = await supabase
      .from('attempts')
      .select('timestamp')
      .order('timestamp', { ascending: false });

    // Fetch all completed checklist items with completed_at
    const { data: checklistData, error: checklistError } = await supabase
      .from('checklist_items')
      .select('completed_at')
      .eq('is_completed', true)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (attemptError || checklistError) {
      console.error('Error fetching streak data:', attemptError || checklistError);
      return { current: 0, longest: 0 };
    }

    // Collect all unique activity days
    const daySet = new Set<string>();

    (attemptData || []).forEach((a: any) => {
      const d = new Date(Number(a.timestamp));
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });

    (checklistData || []).forEach((c: any) => {
      if (c.completed_at) {
        const d = new Date(Number(c.completed_at));
        daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    });

    if (daySet.size === 0) return { current: 0, longest: 0 };

    // Convert to sorted array of day timestamps (start of day)
    const days = Array.from(daySet).map(key => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m, d).getTime();
    }).sort((a, b) => b - a); // Descending

    const MS_DAY = 24 * 60 * 60 * 1000;
    const todayStart = startOfDay(Date.now());
    const yesterdayStart = todayStart - MS_DAY;

    // Current streak: must include today or yesterday
    let current = 0;
    if (days[0] >= yesterdayStart) {
      current = 1;
      for (let i = 1; i < days.length; i++) {
        const diff = days[i - 1] - days[i];
        if (diff <= MS_DAY) {
          current++;
        } else {
          break;
        }
      }
    }

    // Longest streak
    let longest = 1;
    let streak = 1;
    for (let i = 1; i < days.length; i++) {
      const diff = days[i - 1] - days[i];
      if (diff <= MS_DAY) {
        streak++;
        longest = Math.max(longest, streak);
      } else {
        streak = 1;
      }
    }
    longest = Math.max(longest, current);

    return { current, longest };
  },

  getPendingCount: async (): Promise<number> => {
    // Count exercises that are new or red, plus incomplete checklist items
    const [exercises, checklistItems] = await Promise.all([
      storageService.getAllExercises(),
      storageService.getAllChecklistItems()
    ]);

    const pendingExercises = exercises.filter(e => e.status !== 'green').length;
    const pendingChecklist = checklistItems.filter(c => !c.isCompleted).length;

    return pendingExercises + pendingChecklist;
  }
};