import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { storageService } from '../services/storageService';
import { Exercise, Goal, Topic } from '../types';

type ScheduledExercise = {
  exercise: Exercise;
  scheduledAt: number;
};

const MS_DAY = 24 * 60 * 60 * 1000;
const HEBREW_DAYS = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי',
  'שבת'
];

function startOfLocalDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function computeScheduledAt(ex: Exercise): number | null {
  if (ex.status === 'new') return null;

  if (ex.status === 'green') {
    return ex.nextReviewAt ?? null;
  }

  // red
  if (ex.nextReviewAt) return ex.nextReviewAt;
  if (ex.lastAttemptedAt) return ex.lastAttemptedAt + MS_DAY;
  return null;
}

function formatExerciseLocation(location: string) {
  // In this app, `::` is used as a grouping delimiter (see GoalDetails grouping logic).
  // For display, render it as a single colon with spacing.
  return location.split('::').join(': ').replace(/\s+/g, ' ').trim();
}

export const WeeklyPlan: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [dueNowCount, setDueNowCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [loadedGoals, loadedTopics, loadedExercises, reviewQueue] = await Promise.all([
          storageService.getGoals(),
          storageService.getTopics(),
          storageService.getAllExercises(),
          storageService.getReviewQueue()
        ]);

        setGoals(loadedGoals);
        setTopics(loadedTopics);
        setExercises(loadedExercises);
        setDueNowCount(reviewQueue.length);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const { dayStarts, buckets, totalThisWeek } = useMemo(() => {
    const now = Date.now();
    const todayStart = startOfLocalDay(now);
    const starts = Array.from({ length: 7 }, (_, i) => todayStart + i * MS_DAY);

    const initBuckets: ScheduledExercise[][] = Array.from({ length: 7 }, () => []);

    for (const ex of exercises) {
      const scheduledAt = computeScheduledAt(ex);
      if (!scheduledAt) continue;

      // Only show upcoming week. Anything overdue goes into "today".
      const exDayStart = startOfLocalDay(scheduledAt);
      let dayIndex = Math.floor((exDayStart - todayStart) / MS_DAY);
      if (dayIndex < 0) dayIndex = 0;
      if (dayIndex > 6) continue;

      initBuckets[dayIndex].push({ exercise: ex, scheduledAt });
    }

    for (const bucket of initBuckets) {
      bucket.sort((a, b) => a.scheduledAt - b.scheduledAt);
    }

    const total = initBuckets.reduce((sum, b) => sum + b.length, 0);
    return { dayStarts: starts, buckets: initBuckets, totalThisWeek: total };
  }, [exercises]);

  const goalTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of goals) m.set(g.id, g.title);
    return m;
  }, [goals]);

  const topicTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of topics) m.set(t.id, t.title);
    return m;
  }, [topics]);

  if (isLoading) {
    return <div className="text-center p-8 text-slate-500">טוען תכנית שבועית...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">תכנית חזרות שבועית</h2>
          <p className="text-slate-500 mt-2">
            {dueNowCount > 0
              ? `יש לך ${dueNowCount} תרגילים לחזרה עכשיו • ${totalThisWeek} מתוכננים ל-7 הימים הקרובים`
              : `${totalThisWeek} תרגילים מתוכננים ל-7 הימים הקרובים`}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/')}>
            חזרה ללוח הבקרה
          </Button>
          <Button variant="primary" onClick={() => navigate('/review')} disabled={dueNowCount === 0}>
            התחל חזרה{dueNowCount > 0 ? ` (${dueNowCount})` : ''}
          </Button>
        </div>
      </div>

      {totalThisWeek === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-green-800">
          <h3 className="text-xl font-bold">הכל מעודכן!</h3>
          <p className="text-green-700 mt-1">אין חזרות מתוכננות לשבוע הקרוב.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {buckets.map((bucket, i) => {
            const dayStart = dayStarts[i];
            const dayName = HEBREW_DAYS[new Date(dayStart).getDay()];
            const dateLabel = new Date(dayStart).toLocaleDateString('he-IL');
            const isToday = i === 0;

            return (
              <Card
                key={dayStart}
                title={`${dayName}${isToday ? ' (היום)' : ''}`}
                subtitle={`${dateLabel} • ${bucket.length} תרגילים`}
              >
                {bucket.length === 0 ? (
                  <div className="text-sm text-slate-500">אין חזרות ליום הזה.</div>
                ) : (
                  <div className="space-y-2">
                    {bucket.map(({ exercise, scheduledAt }) => {
                      const goalTitle = goalTitleById.get(exercise.goalId) || 'מטרה';
                      const topicTitle = topicTitleById.get(exercise.topicId) || 'נושא';
                      const isOverdue = scheduledAt < Date.now() && i === 0;
                      const timeLabel = new Date(scheduledAt).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const displayLocation = formatExerciseLocation(exercise.location);

                      return (
                        <div
                          key={`${exercise.id}-${scheduledAt}`}
                          className={`p-3 rounded-lg border flex flex-col gap-1 ${
                            isOverdue ? 'bg-red-50/40 border-red-200' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-800 truncate">
                                {displayLocation}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 truncate">
                                {goalTitle} • {topicTitle}
                              </div>
                            </div>
                            <div className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                              {isOverdue ? `באיחור • ${timeLabel}` : timeLabel}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

