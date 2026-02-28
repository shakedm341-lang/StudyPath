import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { Goal, Topic, Exercise, Attempt, ChecklistItem } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmModal } from '../components/ConfirmModal';
import { computeNextReviewDay } from '../utils/dateUtils';

export const GoalDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Bulk Selection State
  const [isTopicSelectionMode, setIsTopicSelectionMode] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Record<string, boolean>>({});
  const [exerciseSelectionModeByTopic, setExerciseSelectionModeByTopic] = useState<Record<string, boolean>>({});
  const [selectedExerciseIdsByTopic, setSelectedExerciseIdsByTopic] = useState<
    Record<string, Record<string, boolean>>
  >({});

  // Modals State
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [activeTopicIdForExercise, setActiveTopicIdForExercise] = useState<string | null>(null);

  // Form State
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [topicDueDate, setTopicDueDate] = useState('');
  const [isBulkTopicMode, setIsBulkTopicMode] = useState(false);
  const [bulkTopicsInput, setBulkTopicsInput] = useState('');

  // Exercise Form State
  const [exLocation, setExLocation] = useState('');
  const [exDueDate, setExDueDate] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSource, setBulkSource] = useState(''); // e.g., "Page 45"
  const [bulkList, setBulkList] = useState(''); // e.g., "1, 2, 3"

  // Checklist State (Local map for input fields per topic)
  const [newChecklistText, setNewChecklistText] = useState<{ [key: string]: string }>({});
  const [newChecklistDate, setNewChecklistDate] = useState<{ [key: string]: string }>({});

  // Collapsed Groups State (For internal exercise grouping)
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({});

  // Expanded Topics State (For main Accordion)
  const [expandedTopics, setExpandedTopics] = useState<{ [key: string]: boolean }>({});

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDestructive: false
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const getSelectedIds = (map: Record<string, boolean>) =>
    Object.keys(map).filter(k => map[k]);

  const selectedTopicIdList = getSelectedIds(selectedTopicIds);

  const loadData = async () => {
    if (id) {
      setLoading(true);

      const [allGoals, t, e, c] = await Promise.all([
        storageService.getGoals(),
        storageService.getTopics(id),
        storageService.getAllExercises(id),
        storageService.getAllChecklistItems(id)
      ]);

      const g = allGoals.find(x => x.id === id);
      if (g) setGoal(g);

      setTopics(t);
      setExercises(e);
      setChecklistItems(c);

      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const exitTopicSelectionMode = () => {
    setIsTopicSelectionMode(false);
    setSelectedTopicIds({});
  };

  const setExerciseSelectionMode = (topicId: string, enabled: boolean) => {
    setExerciseSelectionModeByTopic(prev => ({ ...prev, [topicId]: enabled }));
    if (!enabled) {
      setSelectedExerciseIdsByTopic(prev => {
        if (!prev[topicId]) return prev;
        const next = { ...prev };
        delete next[topicId];
        return next;
      });
    } else {
      setSelectedExerciseIdsByTopic(prev => (prev[topicId] ? prev : { ...prev, [topicId]: {} }));
    }
  };

  const toggleExerciseSelected = (topicId: string, exerciseId: string) => {
    setSelectedExerciseIdsByTopic(prev => ({
      ...prev,
      [topicId]: {
        ...(prev[topicId] || {}),
        [exerciseId]: !(prev[topicId] || {})[exerciseId]
      }
    }));
  };

  const clearSelectedExercises = (topicId: string, idsToClear: string[]) => {
    if (!idsToClear || idsToClear.length === 0) return;
    setSelectedExerciseIdsByTopic(prev => {
      const topicMap = prev[topicId];
      if (!topicMap) return prev;
      const nextTopicMap = { ...topicMap };
      idsToClear.forEach(x => delete nextTopicMap[x]);
      return { ...prev, [topicId]: nextTopicMap };
    });
  };

  const handleAddTopic = async () => {
    if (!id) return;

    let topicsToSave: Topic[] = [];

    if (isBulkTopicMode) {
      const lines = bulkTopicsInput.split('\n').filter(line => line.trim().length > 0);
      if (lines.length === 0) return;

      topicsToSave = lines.map(line => ({
        id: '',
        goalId: id,
        title: line.trim(),
        description: '',
        dueDate: topicDueDate ? new Date(topicDueDate).getTime() : null
      }));
    } else {
      if (!topicTitle.trim()) return;

      topicsToSave = [{
        id: '', // DB generates
        goalId: id,
        title: topicTitle,
        description: topicDesc,
        dueDate: topicDueDate ? new Date(topicDueDate).getTime() : null
      }];
    }

    await storageService.saveTopics(topicsToSave);

    // Update Goal (total topics)
    if (goal) {
      const updatedGoal = { ...goal, totalTopics: goal.totalTopics + topicsToSave.length };
      await storageService.updateGoal(updatedGoal);
    }

    // Refresh
    setTopicTitle('');
    setTopicDesc('');
    setTopicDueDate('');
    setBulkTopicsInput('');
    setIsBulkTopicMode(false);
    setShowTopicModal(false);
    loadData();
  };

  const handleDeleteTopic = (topicId: string) => {
    if (!goal) return;

    setConfirmModal({
      isOpen: true,
      title: 'מחיקת נושא',
      message: 'האם אתה בטוח שברצונך למחוק נושא זה? כל התרגילים והמשימות שבו יימחקו.',
      isDestructive: true,
      onConfirm: async () => {
        // Calculate stats to remove
        const topicExs = exercises.filter(e => e.topicId === topicId);
        const topicChecks = checklistItems.filter(c => c.topicId === topicId);

        const totalToRemove = topicExs.length + topicChecks.length;
        const completedExToRemove = topicExs.filter(e => e.status !== 'new').length;
        const completedCheckToRemove = topicChecks.filter(c => c.isCompleted).length;

        // Optimistic Update
        setTopics(prev => prev.filter(t => t.id !== topicId));
        setExercises(prev => prev.filter(e => e.topicId !== topicId));
        setChecklistItems(prev => prev.filter(c => c.topicId !== topicId));
        setExerciseSelectionModeByTopic(prev => {
          if (!prev[topicId]) return prev;
          const next = { ...prev };
          delete next[topicId];
          return next;
        });
        setSelectedExerciseIdsByTopic(prev => {
          if (!prev[topicId]) return prev;
          const next = { ...prev };
          delete next[topicId];
          return next;
        });

        const updatedGoal = {
          ...goal,
          totalTopics: Math.max(0, goal.totalTopics - 1),
          totalExercises: Math.max(0, goal.totalExercises - totalToRemove),
          completedExercises: Math.max(0, goal.completedExercises - (completedExToRemove + completedCheckToRemove))
        };
        setGoal(updatedGoal);

        // Server Calls
        await storageService.deleteTopic(topicId);
        await storageService.updateGoal(updatedGoal);

        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBulkDeleteTopics = () => {
    if (!goal) return;
    const ids = selectedTopicIdList;
    if (ids.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'מחיקת נושאים',
      message: `האם אתה בטוח שברצונך למחוק ${ids.length} נושאים? כל התרגילים והמשימות שבהם יימחקו.`,
      isDestructive: true,
      confirmText: 'מחק',
      onConfirm: async () => {
        try {
          const topicIdSet = new Set(ids);
          const topicExs = exercises.filter(e => topicIdSet.has(e.topicId));
          const topicChecks = checklistItems.filter(c => topicIdSet.has(c.topicId));

          const totalToRemove = topicExs.length + topicChecks.length;
          const completedExToRemove = topicExs.filter(e => e.status !== 'new').length;
          const completedCheckToRemove = topicChecks.filter(c => c.isCompleted).length;

          // Optimistic UI updates
          setTopics(prev => prev.filter(t => !topicIdSet.has(t.id)));
          setExercises(prev => prev.filter(e => !topicIdSet.has(e.topicId)));
          setChecklistItems(prev => prev.filter(c => !topicIdSet.has(c.topicId)));
          setExerciseSelectionModeByTopic(prev => {
            const next = { ...prev };
            ids.forEach(tid => delete next[tid]);
            return next;
          });
          setSelectedExerciseIdsByTopic(prev => {
            const next = { ...prev };
            ids.forEach(tid => delete next[tid]);
            return next;
          });

          const updatedGoal = {
            ...goal,
            totalTopics: Math.max(0, goal.totalTopics - ids.length),
            totalExercises: Math.max(0, goal.totalExercises - totalToRemove),
            completedExercises: Math.max(
              0,
              goal.completedExercises - (completedExToRemove + completedCheckToRemove)
            )
          };
          setGoal(updatedGoal);

          // Server calls
          const { error } = await storageService.deleteTopics(ids);
          if (error) {
            console.error('Bulk topic delete failed:', error);
            await loadData();
          } else {
            await storageService.updateGoal(updatedGoal);
          }
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          exitTopicSelectionMode();
        }
      }
    });
  };

  const handleBulkDeleteExercises = (topicId: string) => {
    if (!goal) return;
    const ids = getSelectedIds(selectedExerciseIdsByTopic[topicId] || {});
    if (ids.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'מחיקת תרגילים',
      message: `האם אתה בטוח שברצונך למחוק ${ids.length} תרגילים?`,
      isDestructive: true,
      confirmText: 'מחק',
      onConfirm: async () => {
        try {
          const toDelete = exercises.filter(e => e.topicId === topicId && ids.includes(e.id));
          const completedToRemove = toDelete.filter(e => e.status !== 'new').length;

          // Optimistic
          setExercises(prev => prev.filter(e => !ids.includes(e.id)));

          const updatedGoal = {
            ...goal,
            totalExercises: Math.max(0, goal.totalExercises - ids.length),
            completedExercises: Math.max(0, goal.completedExercises - completedToRemove)
          };
          setGoal(updatedGoal);

          const { error } = await storageService.deleteExercises(ids);
          if (error) {
            console.error('Bulk exercise delete failed:', error);
            await loadData();
          } else {
            storageService.updateGoal(updatedGoal);
          }
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          clearSelectedExercises(topicId, ids);
        }
      }
    });
  };

  const handleDeleteExerciseGroup = (topicId: string, groupName: string, groupExs: Exercise[]) => {
    if (!goal) return;
    const ids = groupExs.map(e => e.id).filter(Boolean);
    if (ids.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'מחיקת קבוצה',
      message: `האם אתה בטוח שברצונך למחוק את כל התרגילים בקבוצה "${groupName}"?`,
      isDestructive: true,
      confirmText: 'מחק קבוצה',
      onConfirm: async () => {
        try {
          const completedToRemove = groupExs.filter(e => e.status !== 'new').length;

          // Optimistic
          setExercises(prev => prev.filter(e => !ids.includes(e.id)));

          const updatedGoal = {
            ...goal,
            totalExercises: Math.max(0, goal.totalExercises - ids.length),
            completedExercises: Math.max(0, goal.completedExercises - completedToRemove)
          };
          setGoal(updatedGoal);

          const { error } = await storageService.deleteExercises(ids);
          if (error) {
            console.error('Group delete failed:', error);
            await loadData();
          } else {
            storageService.updateGoal(updatedGoal);
          }
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          clearSelectedExercises(topicId, ids);
        }
      }
    });
  };

  const handleAddExercise = async () => {
    if (!activeTopicIdForExercise || !id) return;

    let exercisesToSave: Exercise[] = [];

    if (isBulkMode) {
      // Bulk Mode Logic
      if (!bulkSource.trim() || !bulkList.trim()) return;

      // Split by comma or whitespace, filter empty
      const items = bulkList.split(/[,]+/).map(s => s.trim()).filter(s => s.length > 0);

      if (items.length === 0) return;

      exercisesToSave = items.map(item => ({
        id: '',
        goalId: id,
        topicId: activeTopicIdForExercise,
        // Use '::' as a separator for Group logic
        location: `${bulkSource.trim()}::${item}`,
        status: 'new',
        lastAttemptedAt: null,
        nextReviewAt: null,
        consecutiveSuccesses: 0,
        dueDate: exDueDate ? new Date(exDueDate).getTime() : null
      }));

    } else {
      // Single Mode Logic
      if (!exLocation.trim()) return;

      const newExercise: Exercise = {
        id: '',
        goalId: id,
        topicId: activeTopicIdForExercise,
        location: exLocation,
        status: 'new',
        lastAttemptedAt: null,
        nextReviewAt: null,
        consecutiveSuccesses: 0,
        dueDate: exDueDate ? new Date(exDueDate).getTime() : null
      };
      exercisesToSave = [newExercise];
    }

    await storageService.saveExercises(exercisesToSave);

    // Update Goal (total exercises count)
    if (goal) {
      const updatedGoal = { ...goal, totalExercises: goal.totalExercises + exercisesToSave.length };
      await storageService.updateGoal(updatedGoal);
    }

    // Auto expand the topic we just added to
    setExpandedTopics(prev => ({ ...prev, [activeTopicIdForExercise]: true }));

    // Reset Form
    setExLocation('');
    setExDueDate('');
    setBulkSource('');
    setBulkList('');
    setIsBulkMode(false);
    setActiveTopicIdForExercise(null);
    loadData();
  };

  const handleDeleteExercise = (ex: Exercise) => {
    if (!goal) return;

    // 1. Validation
    if (!ex.id) {
      console.error("שגיאה: חסר מזהה ייחודי לתרגיל.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'מחיקת תרגיל',
      message: 'האם אתה בטוח שברצונך למחוק תרגיל זה?',
      isDestructive: true,
      onConfirm: async () => {
        // 3. Server Request (Execute Delete)
        const { error } = await storageService.deleteExercise(ex.id);

        if (error) {
          console.error("Delete failed:", error);
          return;
        }

        // 4. Update UI (Only after successful delete)
        setExercises(prev => prev.filter(e => e.id !== ex.id));
        clearSelectedExercises(ex.topicId, [ex.id]);

        // 5. Update Goal Stats
        const wasCompleted = ex.status !== 'new';
        const updatedGoal = {
          ...goal,
          totalExercises: Math.max(0, goal.totalExercises - 1),
          completedExercises: wasCompleted ? Math.max(0, goal.completedExercises - 1) : goal.completedExercises
        };
        setGoal(updatedGoal);

        // Sync stats to server (Fire and forget)
        storageService.updateGoal(updatedGoal);

        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleQuickStatusUpdate = async (exercise: Exercise, isSuccess: boolean) => {
    const now = Date.now();

    const updatedEx: Exercise = {
      ...exercise,
      status: isSuccess ? 'green' : 'red',
      lastAttemptedAt: now,
      // green = done (do not schedule again). red = retry next day (with evening cutoff).
      nextReviewAt: isSuccess ? null : computeNextReviewDay(now),
      consecutiveSuccesses: isSuccess ? (exercise.consecutiveSuccesses + 1) : 0
    };

    // Optimistic UI update
    setExercises(prev => prev.map(e => e.id === exercise.id ? updatedEx : e));

    // DB Updates
    await storageService.updateExercise(updatedEx);

    // Log Attempt
    const attempt: Attempt = {
      id: '',
      exerciseId: exercise.id,
      result: isSuccess ? 'success' : 'failure',
      timestamp: now
    };
    await storageService.logAttempt(attempt);

    // Update Goal progress stats if needed
    if (goal && exercise.status === 'new') {
      const updatedGoal = { ...goal, completedExercises: goal.completedExercises + 1 };
      setGoal(updatedGoal);
      await storageService.updateGoal(updatedGoal);
    }
  };

  // Checklist Handlers
  const handleAddChecklistItem = async (topicId: string) => {
    const text = newChecklistText[topicId];
    const date = newChecklistDate[topicId];
    if (!text || !text.trim() || !id) return;

    const newItem: Partial<ChecklistItem> = {
      topicId,
      goalId: id,
      text: text,
      isCompleted: false,
      dueDate: date ? new Date(date).getTime() : null
    };

    await storageService.saveChecklistItem(newItem);

    // Update Goal stats
    if (goal) {
      const updatedGoal = { ...goal, totalExercises: goal.totalExercises + 1 };
      setGoal(updatedGoal);
      await storageService.updateGoal(updatedGoal);
    }

    setNewChecklistText({ ...newChecklistText, [topicId]: '' });
    setNewChecklistDate({ ...newChecklistDate, [topicId]: '' });
    loadData();
  };

  const handleDeleteChecklistItem = (item: ChecklistItem) => {
    if (!goal) return;

    setConfirmModal({
      isOpen: true,
      title: 'מחיקת משימה',
      message: 'האם אתה בטוח שברצונך למחוק משימה זו?',
      isDestructive: true,
      onConfirm: async () => {
        // Optimistic
        setChecklistItems(prev => prev.filter(c => c.id !== item.id));
        // Update Goal stats
        const updatedGoal = {
          ...goal,
          totalExercises: Math.max(0, goal.totalExercises - 1),
          completedExercises: item.isCompleted ? Math.max(0, goal.completedExercises - 1) : goal.completedExercises
        };
        setGoal(updatedGoal);

        // Server
        await storageService.deleteChecklistItem(item.id);
        await storageService.updateGoal(updatedGoal);

        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleChecklist = async (item: ChecklistItem) => {
    const newStatus = !item.isCompleted;

    // Optimistic Update
    setChecklistItems(prev => prev.map(c => c.id === item.id ? { ...c, isCompleted: newStatus } : c));

    await storageService.toggleChecklistItem(item.id, newStatus);

    // Update Goal stats
    if (goal) {
      const change = newStatus ? 1 : -1;
      const updatedGoal = { ...goal, completedExercises: goal.completedExercises + change };
      setGoal(updatedGoal);
      await storageService.updateGoal(updatedGoal);
    }
  };

  if (loading) return <div>טוען נתונים...</div>;
  if (!goal) return <div>המטרה לא נמצאה</div>;

  const getTopicStats = (topicId: string) => {
    const topicExercises = exercises.filter(e => e.topicId === topicId);
    const topicChecklist = checklistItems.filter(c => c.topicId === topicId);

    const totalUnits = topicExercises.length + topicChecklist.length;

    const greenEx = topicExercises.filter(e => e.status === 'green').length;
    const completedChecklist = topicChecklist.filter(c => c.isCompleted).length;

    const totalMastery = greenEx + completedChecklist;

    return { total: totalUnits, completed: totalMastery };
  };

  // Grouping Logic
  const getGroupedExercises = (topicId: string) => {
    const relevantExercises = exercises.filter(e => e.topicId === topicId);
    const groups: { [key: string]: Exercise[] } = {};
    const ungrouped: Exercise[] = [];

    relevantExercises.forEach(ex => {
      if (ex.location.includes('::')) {
        const [groupName] = ex.location.split('::');
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(ex);
      } else {
        ungrouped.push(ex);
      }
    });

    return { groups, ungrouped };
  };

  // Inline render function to prevent scope issues
  const ExerciseRow = ({
    ex,
    displayName,
    isSelectionMode,
    isSelected,
    onToggleSelected
  }: {
    ex: Exercise;
    displayName?: string;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelected?: () => void;
  }) => {
    const isOverdue = ex.dueDate && ex.dueDate < Date.now() && ex.status === 'new';
    return (
      <div className={`flex items-center justify-between p-3 bg-slate-50 rounded-lg border transition-colors hover:bg-slate-100 group relative ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isSelectionMode && (
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={!!isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelected?.();
              }}
              aria-label={`בחר תרגיל ${displayName || ex.location}`}
            />
          )}
          <span className={`flex-shrink-0 w-3 h-3 rounded-full ${ex.status === 'green' ? 'bg-green-500' :
            ex.status === 'red' ? 'bg-red-500' :
              'bg-slate-300'
            }`}></span>
          <div className="flex flex-col min-w-0">
            <span className={`text-sm font-medium truncate ${ex.status === 'new' ? 'text-slate-500' : 'text-slate-700'
              }`}>
              {displayName || ex.location}
            </span>
            {ex.dueDate && (
              <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                {isOverdue ? 'באיחור: ' : 'יעד: '}
                {new Date(ex.dueDate).toLocaleDateString('he-IL')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 z-[50]">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleQuickStatusUpdate(ex, false);
            }}
            title="סמן כנכשל/בוצע בקושי"
            className={`p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors ${ex.status === 'red' ? 'text-red-500 bg-red-50' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleQuickStatusUpdate(ex, true);
            }}
            title="סמן כבוצע בהצלחה"
            className={`p-1.5 rounded hover:bg-green-100 text-slate-400 hover:text-green-600 transition-colors ${ex.status === 'green' ? 'text-green-500 bg-green-50' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Trash clicked', ex.id);
              handleDeleteExercise(ex);
            }}
            title="מחק תרגיל"
            className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <svg className="w-5 h-5 text-slate-600 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{goal.title}</h1>
            <p className="text-slate-500">{goal.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isTopicSelectionMode ? (
            <>
              <Button variant="secondary" onClick={() => setIsTopicSelectionMode(true)}>
                ניהול
              </Button>
              <Button onClick={() => setShowTopicModal(true)}>+ הוסף נושא</Button>
            </>
          ) : (
            <>
              <div className="text-sm text-slate-600">
                נבחרו: <span className="font-semibold">{selectedTopicIdList.length}</span>
              </div>
              <Button
                variant="danger"
                disabled={selectedTopicIdList.length === 0}
                onClick={handleBulkDeleteTopics}
              >
                מחק נבחרים
              </Button>
              <Button variant="ghost" onClick={exitTopicSelectionMode}>
                ביטול
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {topics.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            עדיין לא נוספו נושאים למטרה זו.
          </div>
        )}
        {topics.map(topic => {
          const stats = getTopicStats(topic.id);
          const readiness = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
          const { groups, ungrouped } = getGroupedExercises(topic.id);
          const isExpanded = expandedTopics[topic.id] || false;
          const isExerciseSelectionMode = !!exerciseSelectionModeByTopic[topic.id];
          const selectedExerciseIds = selectedExerciseIdsByTopic[topic.id] || {};
          const selectedExerciseIdList = getSelectedIds(selectedExerciseIds);

          const isTopicOverdue = topic.dueDate && topic.dueDate < Date.now() && readiness < 100;

          return (
            <Card
              key={topic.id}
              className={`relative overflow-hidden transition-all duration-300 group/card ${isExpanded ? 'ring-2 ring-blue-50' : 'hover:shadow-md'} ${isTopicOverdue ? 'border-red-200' : ''}`}
            >
              {/* Topic Header - Clickable for toggle */}
              <div
                className="flex flex-col md:flex-row justify-between md:items-center gap-4 cursor-pointer"
                onClick={() => toggleTopic(topic.id)}
              >
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {isTopicSelectionMode && (
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={!!selectedTopicIds[topic.id]}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedTopicIds(prev => ({ ...prev, [topic.id]: !prev[topic.id] }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`בחר נושא ${topic.title}`}
                        />
                      )}
                      <svg
                        className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <h3 className="text-xl font-semibold text-slate-900">{topic.title}</h3>
                      {topic.dueDate && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${isTopicOverdue ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          עד: {new Date(topic.dueDate).toLocaleDateString('he-IL')}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm mt-1 pr-7">{topic.description}</p>

                  <div className="mt-4 space-y-2 pr-7">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {stats.total} משימות
                      </span>
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {readiness}% מוכנות
                      </span>
                    </div>
                    {/* Subject progress bar */}
                    <div className="relative h-5 w-full bg-slate-200 rounded-full overflow-hidden mt-1 shadow-inner border border-slate-200/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${readiness === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${readiness}%` }}
                      />
                      <span
                        className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                        style={{
                          color: readiness > 45 ? '#ffffff' : '#334155',
                          textShadow: readiness > 45 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
                        }}
                      >
                        {readiness}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pr-7 md:pr-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); setActiveTopicIdForExercise(topic.id); }}
                  >
                    + תרגיל
                  </Button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.id); }}
                    className="text-slate-300 hover:text-red-500 p-2 rounded hover:bg-red-50 transition-colors"
                    title="מחק נושא"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expandable Content */}
              {isExpanded && (
                <div className="animate-fadeIn">
                  {/* Checklist Section */}
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      צ'ק ליסט למידה
                    </h4>
                    <div className="space-y-2 mb-4">
                      {checklistItems.filter(c => c.topicId === topic.id).map(item => (
                        <div key={item.id} className="flex items-center group/item justify-between hover:bg-slate-50 rounded pl-2">
                          <label className="flex items-center gap-3 cursor-pointer flex-1 p-2 transition-colors">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={item.isCompleted}
                              onChange={() => handleToggleChecklist(item)}
                            />
                            <span className={`text-sm ${item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              {item.text}
                              {item.dueDate && (
                                <span className={`mr-2 text-xs ${item.dueDate < Date.now() && !item.isCompleted ? 'text-red-500' : 'text-slate-400'}`}>
                                  ({new Date(item.dueDate).toLocaleDateString('he-IL')})
                                </span>
                              )}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteChecklistItem(item);
                            }}
                            className="text-slate-400 hover:text-red-500 p-2 rounded hover:bg-red-50 transition-colors z-10"
                            title="מחק משימה"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2 items-center p-2 flex-wrap">
                        <input
                          type="text"
                          placeholder="הוסף משימה (למשל: לקרוא את הסיכום)"
                          className="flex-1 min-w-[200px] text-sm border-b border-slate-200 focus:border-blue-500 outline-none bg-transparent py-1"
                          value={newChecklistText[topic.id] || ''}
                          onChange={(e) => setNewChecklistText({ ...newChecklistText, [topic.id]: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem(topic.id)}
                        />
                        <input
                          type="date"
                          className="text-xs border-b border-slate-200 focus:border-blue-500 outline-none bg-transparent py-1 w-32"
                          value={newChecklistDate[topic.id] || ''}
                          onChange={(e) => setNewChecklistDate({ ...newChecklistDate, [topic.id]: e.target.value })}
                        />
                        <button
                          onClick={() => handleAddChecklistItem(topic.id)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                          disabled={!newChecklistText[topic.id]?.trim()}
                        >
                          הוסף
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Exercises Section */}
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-3 mt-2">
                      <h4 className="text-sm font-semibold text-slate-700">תרגילים (חזרה מרווחת)</h4>
                      {!isExerciseSelectionMode ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setExerciseSelectionMode(topic.id, true)}
                        >
                          בחר תרגילים
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-slate-600">
                            נבחרו: <span className="font-semibold">{selectedExerciseIdList.length}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={selectedExerciseIdList.length === 0}
                            onClick={() => handleBulkDeleteExercises(topic.id)}
                          >
                            מחק נבחרים
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setExerciseSelectionMode(topic.id, false)}>
                            ביטול
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {ungrouped.length === 0 && Object.keys(groups).length === 0 && (
                        <p className="text-sm text-slate-400 italic">אין תרגילים בנושא זה.</p>
                      )}

                      {/* Render Groups First */}
                      {Object.keys(groups).map(groupName => {
                        const groupExs = groups[groupName];
                        const completed = groupExs.filter(e => e.status !== 'new').length;
                        const total = groupExs.length;
                        const isCollapsed = collapsedGroups[topic.id + groupName]; // Unique key logic

                        return (
                          <div key={groupName} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                            <div
                              className="bg-slate-50 p-3 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={(e) => { e.stopPropagation(); toggleGroup(topic.id + groupName); }}
                            >
                              <div className="flex items-center gap-2">
                                <svg className={`w-4 h-4 text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <h5 className="font-semibold text-slate-800 text-sm">{groupName}</h5>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                                  {completed} / {total} הושלמו
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteExerciseGroup(topic.id, groupName, groupExs);
                                  }}
                                  title="מחק קבוצה"
                                  className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {!isCollapsed && (
                              <div className="p-2 space-y-2 border-t border-slate-100">
                                {groupExs.map(ex => {
                                  const displayName = ex.location.split('::')[1];
                                  return (
                                    <React.Fragment key={ex.id}>
                                      <ExerciseRow
                                        ex={ex}
                                        displayName={displayName}
                                        isSelectionMode={isExerciseSelectionMode}
                                        isSelected={!!selectedExerciseIds[ex.id]}
                                        onToggleSelected={() => toggleExerciseSelected(topic.id, ex.id)}
                                      />
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Render Ungrouped Items */}
                      {ungrouped.map(ex => (
                        <React.Fragment key={ex.id}>
                          <ExerciseRow
                            ex={ex}
                            isSelectionMode={isExerciseSelectionMode}
                            isSelected={!!selectedExerciseIds[ex.id]}
                            onToggleSelected={() => toggleExerciseSelected(topic.id, ex.id)}
                          />
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add Topic Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">הוספת נושאים</h3>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>הוספה מרובה</span>
                <button
                  role="switch"
                  aria-checked={isBulkTopicMode}
                  onClick={() => setIsBulkTopicMode(!isBulkTopicMode)}
                  className={`${isBulkTopicMode ? 'bg-blue-600' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                >
                  <span className={`${isBulkTopicMode ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
                </button>
              </div>
            </div>

            {!isBulkTopicMode ? (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">כותרת הנושא</label>
                  <input type="text" className="w-full border border-slate-300 rounded p-2" value={topicTitle} onChange={e => setTopicTitle(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">תיאור</label>
                  <input type="text" className="w-full border border-slate-300 rounded p-2" value={topicDesc} onChange={e => setTopicDesc(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">תאריך יעד (אופציונלי)</label>
                  <input type="date" className="w-full border border-slate-300 rounded p-2" value={topicDueDate} onChange={e => setTopicDueDate(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">רשימת נושאים (כל נושא בשורה חדשה)</label>
                  <textarea
                    className="w-full border border-slate-300 rounded p-2 h-32"
                    value={bulkTopicsInput}
                    onChange={e => setBulkTopicsInput(e.target.value)}
                    placeholder={`מבוא לאלגברה\nמשוואות ריבועיות\nאי שוויונים`}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">תאריך יעד לכל הנושאים (אופציונלי)</label>
                  <input type="date" className="w-full border border-slate-300 rounded p-2" value={topicDueDate} onChange={e => setTopicDueDate(e.target.value)} />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowTopicModal(false)}>ביטול</Button>
              <Button onClick={handleAddTopic}>הוסף {isBulkTopicMode ? 'נושאים' : 'נושא'}</Button>
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
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        isDestructive={confirmModal.isDestructive}
      />

      {/* Add Exercise Modal */}
      {activeTopicIdForExercise && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">הוספת תרגול</h3>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>מצב הוספה מרובה</span>
                <button
                  role="switch"
                  aria-checked={isBulkMode}
                  onClick={() => setIsBulkMode(!isBulkMode)}
                  className={`${isBulkMode ? 'bg-blue-600' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                >
                  <span className={`${isBulkMode ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
                </button>
              </div>
            </div>

            {!isBulkMode ? (
              <>
                <p className="text-sm text-slate-500 mb-4">ציין היכן נמצא התרגיל (לדוגמה: ספר עמוד 45 תרגיל 3, או מבחן 2022 שאלה 5)</p>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">מיקום / רפרנס לתרגיל</label>
                    <input type="text" className="w-full border border-slate-300 rounded p-2" value={exLocation} onChange={e => setExLocation(e.target.value)} placeholder="לדוגמה: מועד ב' 2023 שאלה 2" autoFocus />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">תאריך יעד (אופציונלי)</label>
                    <input type="date" className="w-full border border-slate-300 rounded p-2" value={exDueDate} onChange={e => setExDueDate(e.target.value)} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-4">הוסף מספר תרגילים מאותו מקור בבת אחת.</p>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">מקור משותף</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded p-2"
                      value={bulkSource}
                      onChange={e => setBulkSource(e.target.value)}
                      placeholder="לדוגמה: עמוד 45"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">מספרי שאלות/תרגילים (מופרד בפסיק)</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded p-2"
                      value={bulkList}
                      onChange={e => setBulkList(e.target.value)}
                      placeholder="לדוגמה: 1, 2, 5, 8"
                    />
                    <p className="text-xs text-slate-400 mt-1">ייצור קבוצה: "עמוד 45"</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">תאריך יעד לכולם (אופציונלי)</label>
                    <input type="date" className="w-full border border-slate-300 rounded p-2" value={exDueDate} onChange={e => setExDueDate(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => {
                setActiveTopicIdForExercise(null);
                setIsBulkMode(false);
              }}>ביטול</Button>
              <Button onClick={handleAddExercise}>הוסף תרגיל{isBulkMode ? 'ים' : ''}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};