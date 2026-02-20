import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { storageService } from '../services/storageService';
import { supabase } from '../services/supabaseClient';
import { Goal } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create Goal State
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDescription, setNewGoalDescription] = useState('');

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false
  });

  useEffect(() => {
    loadData();
    // Reduced polling frequency for DB to avoid rate limits/perf issues
    const interval = setInterval(loadData, 30000); 
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
        const [loadedGoals, reviewQueue] = await Promise.all([
            storageService.getGoals(),
            storageService.getReviewQueue()
        ]);
        setGoals(loadedGoals);
        setReviewCount(reviewQueue.length);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleCreateGoal = async () => {
    if (!newGoalTitle.trim()) return;

    const goal: Partial<Goal> = {
      title: newGoalTitle,
      description: newGoalDescription || 'ללא תיאור',
    };
    
    await storageService.saveGoal(goal);

    // Cleanup
    setNewGoalTitle('');
    setNewGoalDescription('');
    setShowAddModal(false);
    loadData();
  };

  const deleteGoal = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmModal({
        isOpen: true,
        title: 'מחיקת מטרה',
        message: 'האם אתה בטוח שברצונך למחוק מטרה זו? פעולה זו לא ניתנת לביטול.',
        isDestructive: true,
        onConfirm: async () => {
            await storageService.deleteGoal(id);
            loadData();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
    });
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  }

  if (isLoading) return <div className="text-center p-8">טוען נתונים...</div>;

  return (
    <div className="space-y-8">
      {/* Welcome & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">לוח הבקרה שלי</h2>
          <p className="text-slate-500 mt-2">עקוב אחר ההתקדמות והשליטה שלך לאורך זמן.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleLogout} className="text-red-500 hover:bg-red-50">
            התנתק
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            + מטרה חדשה
          </Button>
        </div>
      </div>

      {/* Review Call to Action */}
      {reviewCount > 0 ? (
        <div className="bg-gradient-to-l from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">חזרה יומית מוכנה</h3>
            <p className="text-indigo-100 mt-1">יש לך {reviewCount} תרגילים לחזרה בהתבסס על הזיכרון שלך.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/review')}>
            התחל חזרה
          </Button>
        </div>
      ) : (
         <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-green-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">הכל מעודכן!</h3>
            <p className="text-green-700 mt-1">אין חזרות ממתינות. התחל מטרה חדשה או תנוח.</p>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">מטרות פעילות</h3>
        {goals.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-xl">
            <p className="text-slate-500 mb-4">אין מטרות עדיין. צור מטרה חדשה והתחל ללמוד.</p>
            <Button variant="secondary" onClick={() => setShowAddModal(true)}>צור מטרה</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goals.map(goal => (
              <Card 
                key={goal.id} 
                title={goal.title} 
                subtitle={`${goal.totalTopics} נושאים • ${goal.totalExercises} תרגילים`}
                onClick={() => navigate(`/goal/${goal.id}`)}
                action={
                    <button 
                        onClick={(e) => deleteGoal(e, goal.id)}
                        className="text-slate-400 hover:text-red-500 p-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                }
              >
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>התקדמות</span>
                    <span>{goal.totalExercises > 0 ? Math.round((goal.completedExercises / goal.totalExercises) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all" 
                      style={{ width: `${goal.totalExercises > 0 ? (goal.completedExercises / goal.totalExercises) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">יצירת מטרה חדשה</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">שם המטרה</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="למשל: לימוד ספרדית"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateGoal()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">תיאור (אופציונלי)</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="תיאור קצר של מטרות הלימוד"
                  value={newGoalDescription}
                  onChange={(e) => setNewGoalDescription(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateGoal()}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                ביטול
              </Button>
              <Button onClick={handleCreateGoal}>
                צור מטרה
              </Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isDestructive={confirmModal.isDestructive}
      />
    </div>
  );
};