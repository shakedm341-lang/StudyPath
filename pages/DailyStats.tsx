import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { storageService } from '../services/storageService';
import { DailyStats as DailyStatsType, ActivityFeedItem } from '../types';

const HEBREW_DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export const DailyStats: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [todayStats, setTodayStats] = useState<DailyStatsType | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<DailyStatsType[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [today, weekly, feed, streakData, pending] = await Promise.all([
        storageService.getDailyStats(Date.now()),
        storageService.getWeeklyStats(),
        storageService.getActivityFeed(Date.now()),
        storageService.getStudyStreak(),
        storageService.getPendingCount()
      ]);

      setTodayStats(today);
      setWeeklyStats(weekly);
      setActivityFeed(feed);
      setStreak(streakData);
      setPendingCount(pending);
    } catch (e) {
      console.error('Error loading stats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const successRate = useMemo(() => {
    if (!todayStats || todayStats.exercisesReviewed === 0) return 0;
    return Math.round((todayStats.exercisesSucceeded / todayStats.exercisesReviewed) * 100);
  }, [todayStats]);

  const maxWeeklyActivity = useMemo(() => {
    return Math.max(1, ...weeklyStats.map(s => s.totalActivity));
  }, [weeklyStats]);

  if (isLoading) {
    return <div className="text-center p-8 text-slate-500">טוען סטטיסטיקות...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">סטטיסטיקות יומיות</h2>
          <p className="text-slate-500 mt-2">
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/')}>
          חזרה ללוח הבקרה
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Exercises Reviewed */}
        <Card className="!p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="text-sm text-slate-500">תרגילים שנסקרו</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{todayStats?.exercisesReviewed || 0}</div>
          {todayStats && todayStats.exercisesReviewed > 0 && (
            <div className="flex gap-3 mt-2 text-xs">
              <span className="text-green-600">{todayStats.exercisesSucceeded} הצלחות</span>
              <span className="text-red-500">{todayStats.exercisesFailed} כישלונות</span>
            </div>
          )}
        </Card>

        {/* Success Rate */}
        <Card className="!p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-slate-500">אחוז הצלחה</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{successRate}%</div>
          {todayStats && todayStats.exercisesReviewed === 0 && (
            <div className="text-xs text-slate-400 mt-2">אין תרגילים היום</div>
          )}
        </Card>

        {/* Checklist Completed */}
        <Card className="!p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-slate-500">משימות שהושלמו</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{todayStats?.checklistCompleted || 0}</div>
        </Card>

        {/* Pending Items */}
        <Card className="!p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-slate-500">ממתינים</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{pendingCount}</div>
          <div className="text-xs text-slate-400 mt-2">תרגילים + משימות שנותרו</div>
        </Card>
      </div>

      {/* Streak + Weekly History Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Study Streak */}
        <Card className="lg:col-span-1">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">רצף למידה</h3>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">{streak.current}</div>
              <div className="text-sm text-slate-500 mt-1">ימים רצופים</div>
            </div>
            <div className="h-12 w-px bg-slate-200"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-400">{streak.longest}</div>
              <div className="text-sm text-slate-500 mt-1">שיא</div>
            </div>
          </div>
          {streak.current > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-700">
                {streak.current >= 7
                  ? 'מדהים! שבוע שלם של למידה רצופה!'
                  : streak.current >= 3
                  ? 'כל הכבוד! תמשיך ככה!'
                  : 'התחלה טובה! המשך ללמוד כל יום.'}
              </p>
            </div>
          )}
          {streak.current === 0 && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-sm text-slate-500">
                התחל ללמוד היום כדי להתחיל רצף חדש!
              </p>
            </div>
          )}
        </Card>

        {/* 7-Day Activity History */}
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">פעילות ב-7 ימים אחרונים</h3>
          <div className="flex items-end justify-between gap-2 h-40">
            {weeklyStats.map((day, i) => {
              const height = day.totalActivity > 0
                ? Math.max(12, (day.totalActivity / maxWeeklyActivity) * 100)
                : 4;
              const dateObj = new Date(day.date);
              const dayLabel = HEBREW_DAYS_SHORT[dateObj.getDay()];
              const isToday = i === weeklyStats.length - 1;
              const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

              return (
                <div key={day.date} className="flex flex-col items-center flex-1 gap-2">
                  {/* Activity count on top */}
                  {day.totalActivity > 0 && (
                    <span className="text-xs font-medium text-slate-600">{day.totalActivity}</span>
                  )}
                  {/* Bar */}
                  <div className="w-full flex flex-col items-center">
                    <div
                      className={`w-full max-w-[40px] rounded-t-md transition-all ${
                        isToday
                          ? 'bg-blue-500'
                          : day.totalActivity > 0
                          ? 'bg-blue-300'
                          : 'bg-slate-100'
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${day.totalActivity} פעילויות`}
                    >
                      {/* Stacked: exercises portion */}
                      {day.exercisesReviewed > 0 && day.checklistCompleted > 0 && (
                        <div
                          className={`w-full rounded-t-md ${isToday ? 'bg-blue-600' : 'bg-blue-400'}`}
                          style={{
                            height: `${(day.exercisesReviewed / day.totalActivity) * 100}%`,
                            minHeight: '4px'
                          }}
                        ></div>
                      )}
                    </div>
                  </div>
                  {/* Labels */}
                  <div className="text-center">
                    <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-600'}`}>
                      {dayLabel}
                    </div>
                    <div className="text-[10px] text-slate-400">{dateStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-400 inline-block"></span>
              תרגילים
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-200 inline-block"></span>
              משימות
            </span>
          </div>
        </Card>
      </div>

      {/* Today's Activity Feed */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">פעילות היום</h3>
        {activityFeed.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-500 mb-1">אין פעילות היום עדיין</p>
            <p className="text-sm text-slate-400">התחל חזרה או השלם משימות כדי לראות פעילות כאן.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {activityFeed.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  item.type === 'attempt'
                    ? item.result === 'success'
                      ? 'bg-green-100'
                      : 'bg-red-100'
                    : 'bg-purple-100'
                }`}>
                  {item.type === 'attempt' ? (
                    item.result === 'success' ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )
                  ) : (
                    <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      item.type === 'attempt'
                        ? item.result === 'success'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                        : 'bg-purple-50 text-purple-700'
                    }`}>
                      {item.type === 'attempt'
                        ? item.result === 'success' ? 'הצלחה' : 'כישלון'
                        : 'משימה הושלמה'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1 truncate">{item.description}</p>
                </div>

                {/* Time */}
                <div className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(item.timestamp).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
