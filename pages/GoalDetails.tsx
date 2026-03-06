import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { Goal, Topic, Exercise, Attempt, ChecklistItem, Exam } from '../types';
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
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeTab, setActiveTab] = useState<'topics' | 'exams'>('topics');
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
  const [showExamModal, setShowExamModal] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examDesc, setExamDesc] = useState('');
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

  // Exercise Filter State per topic
  const [exerciseFilterByTopic, setExerciseFilterByTopic] = useState<Record<string, 'all' | 'needs-review' | 'to-complete'>>({});

  // Expanded Topics State (For main Accordion)
  const [expandedTopics, setExpandedTopics] = useState<{ [key: string]: boolean }>({});

  // Exam Accordion State
  const [expandedExams, setExpandedExams] = useState<Record<string, boolean>>({});
  const [examExercises, setExamExercises] = useState<Record<string, Exercise[]>>({});
  const [examExerciseLoading, setExamExerciseLoading] = useState<Record<string, boolean>>({});
  const [activeExamIdForExercise, setActiveExamIdForExercise] = useState<string | null>(null);
  const [examExLocation, setExamExLocation] = useState('');
  const [examBulkList, setExamBulkList] = useState('');
  const [examIsBulkMode, setExamIsBulkMode] = useState(false);
  const [examExDueDate, setExamExDueDate] = useState('');
  const [examSelectedTopics, setExamSelectedTopics] = useState<string[]>([]);

  // Exam Edit Mode State
  const [examEditMode, setExamEditMode] = useState<Record<string, boolean>>({});
  const [examPendingEdits, setExamPendingEdits] = useState<Record<string, { location: string; topicIds: string[] }>>({});
  const [openTopicDropdown, setOpenTopicDropdown] = useState<string | null>(null); // exercise id

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

      const [allGoals, t, e, c, ex] = await Promise.all([
        storageService.getGoals(),
        storageService.getTopics(id),
        storageService.getAllExercises(id),
        storageService.getAllChecklistItems(id),
        storageService.getExams(id)
      ]);

      const g = allGoals.find(x => x.id === id);
      if (g) setGoal(g);

      setTopics(t);
      setExercises(e);
      setChecklistItems(c);
      setExams(ex || []);

      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const loadExamExercises = async (examId: string) => {
    if (!id) return;
    setExamExerciseLoading(prev => ({ ...prev, [examId]: true }));
    const exs = await storageService.getAllExercises(id, examId);
    setExamExercises(prev => ({ ...prev, [examId]: exs }));
    setExamExerciseLoading(prev => ({ ...prev, [examId]: false }));
  };

  const toggleExam = (examId: string) => {
    const willOpen = !expandedExams[examId];
    setExpandedExams(prev => ({ ...prev, [examId]: willOpen }));
    if (willOpen) {
      loadExamExercises(examId);
    }
  };

  const handleAddExerciseToExam = async () => {
    if (!activeExamIdForExercise || !id) return;
    let toSave: Exercise[] = [];
    if (!examIsBulkMode) {
      if (!examExLocation.trim()) return;
      toSave = [{
        id: '', topicIds: examSelectedTopics, examId: activeExamIdForExercise,
        goalId: id, location: examExLocation.trim(), status: 'new',
        consecutiveSuccesses: 0,
        dueDate: examExDueDate ? new Date(examExDueDate).getTime() : undefined,
        lastAttemptedAt: undefined, nextReviewAt: undefined,
      }];
    } else {
      if (!examBulkList.trim()) return;
      const items = examBulkList.split(/[\n,]+/).map(i => i.trim()).filter(i => i.length > 0);
      toSave = items.map(item => ({
        id: '', topicIds: examSelectedTopics, examId: activeExamIdForExercise,
        goalId: id, location: item, status: 'new',
        consecutiveSuccesses: 0,
        dueDate: examExDueDate ? new Date(examExDueDate).getTime() : undefined,
        lastAttemptedAt: undefined, nextReviewAt: undefined,
      }));
    }
    if (toSave.length > 0) {
      await storageService.saveExercises(toSave);
      setExamExLocation('');
      setExamBulkList('');
      setExamExDueDate('');
      setExamSelectedTopics([]);
      setExamIsBulkMode(false);
      const examId = activeExamIdForExercise;
      setActiveExamIdForExercise(null);
      loadExamExercises(examId);
    }
  };

  const handleExamEnterEditMode = (examId: string) => {
    const exs = examExercises[examId] || [];
    const initial: Record<string, { location: string; topicIds: string[] }> = {};
    exs.forEach(ex => { initial[ex.id] = { location: ex.location, topicIds: ex.topicIds || [] }; });
    setExamPendingEdits(initial);
    setExamEditMode(prev => ({ ...prev, [examId]: true }));
  };

  const handleExamSaveEdits = async (examId: string) => {
    const exs = examExercises[examId] || [];
    const promises: Promise<any>[] = [];
    for (const ex of exs) {
      const edit = examPendingEdits[ex.id];
      if (!edit) continue;
      const origTopics = [...(ex.topicIds || [])].sort().join(',');
      const newTopics = [...edit.topicIds].sort().join(',');
      if (edit.location !== ex.location || origTopics !== newTopics) {
        promises.push(storageService.updateExerciseFull({ ...ex, location: edit.location, topicIds: edit.topicIds }));
      }
    }
    if (promises.length > 0) await Promise.all(promises);
    setExamEditMode(prev => ({ ...prev, [examId]: false }));
    setOpenTopicDropdown(null);
    loadExamExercises(examId);
  };

  const handleDeleteExamExercise = (exerciseId: string, examId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'מחיקת שאלה',
      message: 'האם אתה בטוח שברצונך למחוק שאלה זו?',
      isDestructive: true,
      onConfirm: async () => {
        await storageService.deleteExercise(exerciseId);
        setExamExercises(prev => ({ ...prev, [examId]: (prev[examId] || []).filter(e => e.id !== exerciseId) }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleExamStatusChange = async (ex: Exercise, examId: string, isSuccess: boolean) => {
    const now = Date.now();
    const targetStatus = isSuccess ? 'green' : 'red';

    // Toggle: clicking the already-active button resets to 'new' (gray)
    const newStatus = ex.status === targetStatus ? 'new' : targetStatus;

    const updatedEx: Exercise = {
      ...ex,
      status: newStatus,
      lastAttemptedAt: newStatus === 'new' ? null : now,
      nextReviewAt: newStatus === 'red' ? computeNextReviewDay(now) : null,
      consecutiveSuccesses: newStatus === 'green' ? ex.consecutiveSuccesses + 1 : 0,
    };
    setExamExercises(prev => ({ ...prev, [examId]: (prev[examId] || []).map(e => e.id === ex.id ? updatedEx : e) }));
    await storageService.updateExercise(updatedEx);
    // Always clear today's attempts first, then log the new one if not resetting
    await storageService.deleteAttemptsForExerciseToday(ex.id);
    if (newStatus !== 'new') {
      await storageService.logAttempt({ id: '', exerciseId: ex.id, result: isSuccess ? 'success' : 'failure', timestamp: now });
    }
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

  const handleAddExam = async () => {
    if (!id || !examTitle.trim()) return;
    await storageService.saveExam({
      id: '',
      title: examTitle,
      description: examDesc,
      goalId: id
    });
    setExamTitle('');
    setExamDesc('');
    setShowExamModal(false);
    loadData();
  };

  const handleDeleteExam = (examId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'מחיקת מבחן',
      message: 'האם אתה בטוח שברצונך למחוק מבחן זה?',
      isDestructive: true,
      onConfirm: async () => {
        setExams(prev => prev.filter(x => x.id !== examId));
        await storageService.deleteExam(examId);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
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
        const topicExs = exercises.filter(e => e.topicIds?.includes(topicId));
        const topicChecks = checklistItems.filter(c => c.topicId === topicId);

        const totalToRemove = topicExs.length + topicChecks.length;
        const completedExToRemove = topicExs.filter(e => e.status !== 'new').length;
        const completedCheckToRemove = topicChecks.filter(c => c.isCompleted).length;

        // Optimistic Update
        setTopics(prev => prev.filter(t => t.id !== topicId));
        setExercises(prev => prev.map(e => ({ ...e, topicIds: e.topicIds.filter(id => id !== topicId) })).filter(e => e.topicIds.length > 0));
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
          const topicExs = exercises.filter(e => e.topicIds?.some(id => topicIdSet.has(id)));
          const topicChecks = checklistItems.filter(c => topicIdSet.has(c.topicId));

          const totalToRemove = topicExs.length + topicChecks.length;
          const completedExToRemove = topicExs.filter(e => e.status !== 'new').length;
          const completedCheckToRemove = topicChecks.filter(c => c.isCompleted).length;

          // Optimistic UI updates
          setTopics(prev => prev.filter(t => !topicIdSet.has(t.id)));
          setExercises(prev => prev.map(e => ({ ...e, topicIds: e.topicIds.filter(id => !topicIdSet.has(id)) })).filter(e => e.topicIds.length > 0));
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
          const toDelete = exercises.filter(e => e.topicIds?.includes(topicId) && ids.includes(e.id));
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
        topicIds: [activeTopicIdForExercise],
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
        topicIds: [activeTopicIdForExercise],
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
        ex.topicIds?.forEach(tId => clearSelectedExercises(tId, [ex.id]));

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
    const targetStatus = isSuccess ? 'green' : 'red';

    // Toggle: clicking the already-active button resets to 'new' (gray)
    const newStatus = exercise.status === targetStatus ? 'new' : targetStatus;

    const updatedEx: Exercise = {
      ...exercise,
      status: newStatus,
      lastAttemptedAt: newStatus === 'new' ? null : now,
      nextReviewAt: newStatus === 'red' ? computeNextReviewDay(now) : null,
      consecutiveSuccesses: newStatus === 'green' ? (exercise.consecutiveSuccesses + 1) : 0
    };

    // Optimistic UI update
    setExercises(prev => prev.map(e => e.id === exercise.id ? updatedEx : e));

    // DB Updates
    await storageService.updateExercise(updatedEx);

    // Always clear today's attempts first, then log the new one if not resetting
    await storageService.deleteAttemptsForExerciseToday(exercise.id);
    if (newStatus !== 'new') {
      const attempt: Attempt = {
        id: '',
        exerciseId: exercise.id,
        result: isSuccess ? 'success' : 'failure',
        timestamp: now
      };
      await storageService.logAttempt(attempt);
    }

    // Update Goal progress stats
    if (goal) {
      const wasCompleted = exercise.status !== 'new';
      const isNowCompleted = newStatus !== 'new';
      if (!wasCompleted && isNowCompleted) {
        // new -> marked: increment
        const updatedGoal = { ...goal, completedExercises: goal.completedExercises + 1 };
        setGoal(updatedGoal);
        await storageService.updateGoal(updatedGoal);
      } else if (wasCompleted && !isNowCompleted) {
        // marked -> reset: decrement
        const updatedGoal = { ...goal, completedExercises: Math.max(0, goal.completedExercises - 1) };
        setGoal(updatedGoal);
        await storageService.updateGoal(updatedGoal);
      }
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
    const topicExercises = exercises.filter(e => e.topicIds?.includes(topicId));
    const topicChecklist = checklistItems.filter(c => c.topicId === topicId);

    const totalUnits = topicExercises.length + topicChecklist.length;

    const completedEx = topicExercises.filter(e => e.status !== 'new').length;
    const greenEx = topicExercises.filter(e => e.status === 'green').length;

    const completedChecklist = topicChecklist.filter(c => c.isCompleted).length;

    const totalCompleted = completedEx + completedChecklist;
    const totalMastered = greenEx + completedChecklist;

    return { total: totalUnits, completed: totalCompleted, mastered: totalMastered };
  };

  // Grouping Logic
  const getGroupedExercises = (topicId: string) => {
    const relevantExercises = exercises.filter(e => e.topicIds?.includes(topicId));
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

  // Compact card for grid display
  const ExerciseCard = ({
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
    const label = displayName || ex.location;

    const cardBase =
      ex.status === 'green'
        ? 'bg-green-50 border-green-200 text-green-800'
        : ex.status === 'red'
          ? 'bg-red-50 border-red-200 text-red-800'
          : isOverdue
            ? 'bg-red-50/40 border-red-200 text-slate-700'
            : 'bg-white border-slate-200 text-slate-700';

    return (
      <div
        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2 min-h-[72px] cursor-pointer select-none transition-all duration-150 hover:shadow-md active:scale-95 ${cardBase}`}
        onClick={(e) => {
          e.stopPropagation();
          // Cycle: new → green → red → new
          if (ex.status === 'new') {
            handleQuickStatusUpdate(ex, true);   // new → green
          } else if (ex.status === 'green') {
            handleQuickStatusUpdate(ex, false);  // green → red
          } else {
            // red → new: pass current status as target to trigger toggle-reset
            handleQuickStatusUpdate(ex, false);  // red → new (toggle off red)
          }
        }}
        title={label}
      >
        {isSelectionMode && (
          <input
            type="checkbox"
            className="absolute top-1 right-1 w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={!!isSelected}
            onChange={(e) => { e.stopPropagation(); onToggleSelected?.(); }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {/* Status Icon */}
        <span className="text-base leading-none">
          {ex.status === 'green' ? '✓' : ex.status === 'red' ? '✗' : '○'}
        </span>
        {/* Label */}
        <span className="text-xs font-semibold leading-tight text-center line-clamp-2 w-full px-0.5">
          {label}
        </span>
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
          {activeTab === 'topics' ? (
            !isTopicSelectionMode ? (
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
            )
          ) : (
            <Button onClick={() => setShowExamModal(true)}>+ הוסף מבחן</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
        <button
          onClick={() => setActiveTab('topics')}
          className={`flex-1 py-2 text-center rounded-lg font-medium transition-colors ${activeTab === 'topics' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
        >
          נושאים
        </button>
        <button
          onClick={() => setActiveTab('exams')}
          className={`flex-1 py-2 text-center rounded-lg font-medium transition-colors ${activeTab === 'exams' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
        >
          מבחנים ({exams.length})
        </button>
      </div>

      {activeTab === 'topics' ? (
        <div className="grid grid-cols-1 gap-6">
          {topics.length === 0 && (
            <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
              עדיין לא נוספו נושאים למטרה זו.
            </div>
          )}
          {topics.map(topic => {
            const stats = getTopicStats(topic.id);
            const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            const readiness = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
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

                    <div className="mt-4 space-y-3 pr-7">

                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium tracking-wide">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></span>
                          התקדמות: {progress}%
                        </span>
                        <span className="flex items-center gap-1.5 text-green-700 font-medium tracking-wide">
                          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          מוכנות: {readiness}%
                        </span>
                        <span className="text-xs text-slate-400 font-normal mr-auto">סה"כ: {stats.total} משימות</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                        <div
                          className="h-full bg-gradient-to-l from-blue-400 to-blue-600 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${progress}%` }}
                        />
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
                      {/* Section header row */}
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

                      {/* Filter Chips */}
                      {(() => {
                        const activeFilter = exerciseFilterByTopic[topic.id] || 'all';
                        const setFilter = (f: 'all' | 'needs-review' | 'to-complete') =>
                          setExerciseFilterByTopic(prev => ({ ...prev, [topic.id]: f }));
                        const needsReviewCount = exercises.filter(e => e.topicIds?.includes(topic.id) && e.status === 'red').length;
                        const toCompleteCount = exercises.filter(e => e.topicIds?.includes(topic.id) && e.status === 'new').length;

                        return (
                          <div className="flex gap-2 mb-4 flex-wrap">
                            <button
                              onClick={() => setFilter('all')}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeFilter === 'all'
                                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                }`}
                            >
                              הכל
                            </button>
                            <button
                              onClick={() => setFilter('needs-review')}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeFilter === 'needs-review'
                                ? 'bg-red-500 text-white border-red-500 shadow-sm'
                                : 'bg-red-50 text-red-600 border-red-200 hover:border-red-400'
                                }`}
                            >
                              צריך חזרה {needsReviewCount > 0 && `(${needsReviewCount})`}
                            </button>
                            <button
                              onClick={() => setFilter('to-complete')}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeFilter === 'to-complete'
                                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                                : 'bg-green-50 text-green-700 border-green-200 hover:border-green-400'
                                }`}
                            >
                              להשלמה {toCompleteCount > 0 && `(${toCompleteCount})`}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Exercises Content */}
                      <div className="space-y-4">
                        {ungrouped.length === 0 && Object.keys(groups).length === 0 && (
                          <p className="text-sm text-slate-400 italic">אין תרגילים בנושא זה.</p>
                        )}

                        {/* Grouped exercises */}
                        {Object.keys(groups).map(groupName => {
                          const groupExs = groups[groupName];
                          const completed = groupExs.filter(e => e.status !== 'new').length;
                          const total = groupExs.length;
                          const isCollapsed = collapsedGroups[topic.id + groupName];
                          const activeFilter = exerciseFilterByTopic[topic.id] || 'all';

                          const filteredGroupExs = groupExs.filter(ex => {
                            if (activeFilter === 'needs-review') return ex.status === 'red';
                            if (activeFilter === 'to-complete') return ex.status === 'new';
                            return true;
                          });

                          if (filteredGroupExs.length === 0 && activeFilter !== 'all') return null;

                          return (
                            <div key={groupName} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                              {/* Group header */}
                              <div
                                className="bg-slate-50 px-3 py-2.5 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); toggleGroup(topic.id + groupName); }}
                              >
                                <div className="flex items-center gap-2">
                                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <h5 className="font-semibold text-slate-800 text-sm">{groupName}</h5>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                    {completed}/{total}
                                  </span>
                                  {/* Trash for whole group – low opacity, hover to reveal */}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteExerciseGroup(topic.id, groupName, groupExs); }}
                                    title="מחק קבוצה"
                                    className="p-1.5 rounded hover:bg-red-50 text-slate-300 opacity-40 hover:opacity-100 hover:text-red-500 transition-all"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Grid of exercise cards */}
                              {!isCollapsed && (
                                <div className="p-3 border-t border-slate-100">
                                  <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                                    {(activeFilter === 'all' ? groupExs : filteredGroupExs).map(ex => {
                                      const displayName = ex.location.split('::')[1];
                                      return (
                                        <ExerciseCard
                                          key={ex.id}
                                          ex={ex}
                                          displayName={displayName}
                                          isSelectionMode={isExerciseSelectionMode}
                                          isSelected={!!selectedExerciseIds[ex.id]}
                                          onToggleSelected={() => toggleExerciseSelected(topic.id, ex.id)}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Ungrouped exercises grid */}
                        {(() => {
                          const activeFilter = exerciseFilterByTopic[topic.id] || 'all';
                          const filteredUngrouped = ungrouped.filter(ex => {
                            if (activeFilter === 'needs-review') return ex.status === 'red';
                            if (activeFilter === 'to-complete') return ex.status === 'new';
                            return true;
                          });
                          if (filteredUngrouped.length === 0) return null;
                          return (
                            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                              {filteredUngrouped.map(ex => (
                                <ExerciseCard
                                  key={ex.id}
                                  ex={ex}
                                  isSelectionMode={isExerciseSelectionMode}
                                  isSelected={!!selectedExerciseIds[ex.id]}
                                  onToggleSelected={() => toggleExerciseSelected(topic.id, ex.id)}
                                />
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {exams.length === 0 && (
            <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
              עדיין לא נוספו מבחנים.
            </div>
          )}
          {exams.map(exam => {
            const isExpanded = !!expandedExams[exam.id];
            const isEditMode = !!examEditMode[exam.id];
            const examExs = examExercises[exam.id] || [];
            const isLoading = !!examExerciseLoading[exam.id];

            return (
              <Card key={exam.id} className={`transition-all duration-300 relative group ${isExpanded ? 'ring-2 ring-blue-50' : 'hover:shadow-md'}`}>
                {/* Header row */}
                <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleExam(exam.id)}>
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{exam.title}</h3>
                      {exam.description && <p className="text-slate-500 mt-0.5 text-sm">{exam.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {isExpanded && !isEditMode && (
                      <>
                        <button
                          onClick={() => handleExamEnterEditMode(exam.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
                        >
                          עריכת שאלות
                        </button>
                        <button
                          onClick={() => setActiveExamIdForExercise(exam.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors"
                        >
                          + הוסף שאלות
                        </button>
                      </>
                    )}
                    {isExpanded && isEditMode && (
                      <>
                        <button
                          onClick={() => { setExamEditMode(prev => ({ ...prev, [exam.id]: false })); setOpenTopicDropdown(null); }}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
                        >
                          ביטול
                        </button>
                        <button
                          onClick={() => handleExamSaveEdits(exam.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                        >
                          שמור שינויים
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteExam(exam.id); }}
                      className="p-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500 rounded-lg"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                    {isLoading && <p className="text-sm text-slate-400 text-center py-4">טוען שאלות...</p>}
                    {!isLoading && examExs.length === 0 && (
                      <p className="text-sm text-slate-400 italic text-center py-4">עדיין לא נוספו שאלות למבחן זה.</p>
                    )}
                    {!isLoading && examExs.map(ex => {
                      const displayLocation = ex.location.split('::').join(': ').replace(/\s+/g, ' ').trim();
                      const assignedTopics = topics.filter(t => (examPendingEdits[ex.id]?.topicIds ?? ex.topicIds ?? []).includes(t.id));
                      const unassignedTopics = topics.filter(t => !(examPendingEdits[ex.id]?.topicIds ?? ex.topicIds ?? []).includes(t.id));

                      return (
                        <div key={ex.id} className={`flex items-start justify-between p-3 rounded-lg border transition-colors ${ex.status === 'green' ? 'bg-green-50/40 border-green-100' :
                          ex.status === 'red' ? 'bg-red-50/40 border-red-100' :
                            'bg-slate-50 border-slate-100'
                          }`}>
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className={`flex-shrink-0 w-3 h-3 rounded-full mt-1 ${ex.status === 'green' ? 'bg-green-500' :
                              ex.status === 'red' ? 'bg-red-500' :
                                ex.status === 'orange' ? 'bg-orange-400' : 'bg-slate-300'
                              }`} />
                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                              {isEditMode ? (
                                <input
                                  className="text-sm font-medium text-slate-800 border-b border-slate-300 focus:border-blue-500 outline-none px-1 py-0.5 w-full bg-transparent"
                                  value={examPendingEdits[ex.id]?.location ?? ex.location}
                                  onChange={e => setExamPendingEdits(prev => ({ ...prev, [ex.id]: { ...prev[ex.id], location: e.target.value } }))}
                                />
                              ) : (
                                <span className="text-sm font-medium text-slate-700 truncate">{displayLocation}</span>
                              )}

                              {/* Topic tags */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {assignedTopics.map(t => (
                                  <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                    {t.title}
                                    {isEditMode && (
                                      <button
                                        onClick={() => setExamPendingEdits(prev => ({
                                          ...prev,
                                          [ex.id]: { ...prev[ex.id], topicIds: prev[ex.id].topicIds.filter(tid => tid !== t.id) }
                                        }))}
                                        className="hover:text-red-500 ml-0.5 transition-colors"
                                      >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    )}
                                  </span>
                                ))}

                                {/* + נושא dropdown */}
                                {isEditMode && unassignedTopics.length > 0 && (
                                  <div className="relative">
                                    <button
                                      onClick={() => setOpenTopicDropdown(prev => prev === ex.id ? null : ex.id)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-300 transition-colors"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      נושא
                                    </button>
                                    {openTopicDropdown === ex.id && (
                                      <div className="absolute z-50 top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
                                        {unassignedTopics.map(t => (
                                          <button
                                            key={t.id}
                                            onClick={() => {
                                              setExamPendingEdits(prev => ({
                                                ...prev,
                                                [ex.id]: { ...prev[ex.id], topicIds: [...(prev[ex.id]?.topicIds || []), t.id] }
                                              }));
                                              setOpenTopicDropdown(null);
                                            }}
                                            className="block w-full text-right px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                          >
                                            {t.title}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                            {!isEditMode && (
                              <>
                                <button
                                  onClick={() => handleExamStatusChange(ex, exam.id, false)}
                                  title="נכשל"
                                  className={`p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors ${ex.status === 'red' ? 'text-red-500 bg-red-50' : ''}`}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleExamStatusChange(ex, exam.id, true)}
                                  title="הצלחה"
                                  className={`p-1.5 rounded hover:bg-green-100 text-slate-400 hover:text-green-600 transition-colors ${ex.status === 'green' ? 'text-green-500 bg-green-50' : ''}`}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteExamExercise(ex.id, exam.id)}
                              title="מחק שאלה"
                              className="p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
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

      {/* Add Topic Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-fade-in-up">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-semibold text-slate-800">נושא חדש</h3>
              <button
                onClick={() => setShowTopicModal(false)}
                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">

              <div className="flex items-center gap-4 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setIsBulkTopicMode(false)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isBulkTopicMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                >
                  הזנה בודדת
                </button>
                <button
                  onClick={() => setIsBulkTopicMode(true)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isBulkTopicMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                >
                  הזנה מרובה
                </button>
              </div>

              {!isBulkTopicMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      שם הנושא
                    </label>
                    <input
                      type="text"
                      placeholder="למשל: סדרות חשבוניות"
                      value={topicTitle}
                      onChange={(e) => setTopicTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      תיאור (אופציונלי)
                    </label>
                    <textarea
                      placeholder="למשל: נוסחת האיבר ה-n וסכום סדרה"
                      value={topicDesc}
                      onChange={(e) => setTopicDesc(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      תאריך יעד למעבר ראשוני (אופציונלי)
                    </label>
                    <input
                      type="date"
                      value={topicDueDate}
                      onChange={(e) => setTopicDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm text-slate-600 h-[46px]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm leading-relaxed">
                    הזן רשימה של נושאים, כל נושא בשורה חדשה.<br />
                    המערכת תיצור את כל הנושאים בבת אחת.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      רשימת נושאים
                    </label>
                    <textarea
                      placeholder={"סדרות חשבוניות\nסדרות הנדסיות\nטריגונומטריה במרחב"}
                      value={bulkTopicsInput}
                      onChange={(e) => setBulkTopicsInput(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      תאריך יעד לכולם (אופציונלי)
                    </label>
                    <input
                      type="date"
                      value={topicDueDate}
                      onChange={(e) => setTopicDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm text-slate-600 h-[46px]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowTopicModal(false)}>
                ביטול
              </Button>
              <Button onClick={handleAddTopic} disabled={(!isBulkTopicMode && !topicTitle.trim()) || (isBulkTopicMode && !bulkTopicsInput.trim())}>
                שמור נושא{isBulkTopicMode && 'ים'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Creation Modal */}
      {showExamModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-fade-in-up">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-semibold text-slate-800">מבחן חדש</h3>
              <button
                onClick={() => setShowExamModal(false)}
                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">שם המבחן</label>
                <input
                  type="text"
                  placeholder="למשל: מועד א' 2023"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">תיאור (אופציונלי)</label>
                <textarea
                  placeholder="מידע נוסף לגבי המבחן"
                  value={examDesc}
                  onChange={(e) => setExamDesc(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowExamModal(false)}>ביטול</Button>
              <Button onClick={handleAddExam} disabled={!examTitle.trim()}>שמור מבחן</Button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Creation Modal */}
      {activeTopicIdForExercise && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-fade-in-up">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-semibold text-slate-800">תרגיל חדש</h3>
              <button
                onClick={() => {
                  setActiveTopicIdForExercise(null);
                  setExLocation('');
                  setBulkSource('');
                  setBulkList('');
                }}
                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">

              <div className="flex items-center gap-4 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setIsBulkMode(false)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isBulkMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                >
                  הזנה בודדת
                </button>
                <button
                  onClick={() => setIsBulkMode(true)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isBulkMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                >
                  הזנה מרובה
                </button>
              </div>

              {!isBulkMode ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      מיקום / זיהוי התרגיל
                    </label>
                    <input
                      type="text"
                      placeholder="למשל: דף 45 תרגיל 3, או מועד א שנת 2023"
                      value={exLocation}
                      onChange={(e) => setExLocation(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      תאריך יעד למעבר (אופציונלי)
                    </label>
                    <input
                      type="date"
                      value={exDueDate}
                      onChange={(e) => setExDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm text-slate-600 h-[46px]"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm leading-relaxed">
                    צור רשימת תרגילים מאותו המקור בקלות. המערכת תחבר את המקור לכל אחד מהמספרים שתזין.<br />
                    לדוגמה: אם המקור הוא "עמוד 45" והרשימה היא "1, 2, 3", יווצרו 3 תרגילים שונים ויקובצו יחד בתצוגה.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      שם המקור
                    </label>
                    <input
                      type="text"
                      placeholder="למשל: עמוד 45, חוברת חזרה"
                      value={bulkSource}
                      onChange={(e) => setBulkSource(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      רשימת תרגילים (מופרדים בפסיק, רווח או אנטר)
                    </label>
                    <textarea
                      placeholder={"לדוגמה:\n1, 2, 3, 4\nאו\n1א\n1ב\n1ג"}
                      value={bulkList}
                      onChange={(e) => setBulkList(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      תאריך יעד לכולם (אופציונלי)
                    </label>
                    <input
                      type="date"
                      value={exDueDate}
                      onChange={(e) => setExDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm text-slate-600 h-[46px]"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <Button variant="ghost" onClick={() => {
                setActiveTopicIdForExercise(null);
                setExLocation('');
                setBulkSource('');
                setBulkList('');
              }}>
                ביטול
              </Button>
              <Button onClick={handleAddExercise} disabled={(!isBulkMode && !exLocation.trim()) || (isBulkMode && (!bulkSource.trim() || !bulkList.trim()))}>
                צור תרגיל{isBulkMode && 'ים'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Exercise Creation Modal */}
      {activeExamIdForExercise && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
              <h3 className="text-xl font-semibold text-slate-800">הוספת שאלות למבחן</h3>
              <button
                onClick={() => { setActiveExamIdForExercise(null); setExamExLocation(''); setExamBulkList(''); setExamSelectedTopics([]); setExamIsBulkMode(false); }}
                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Single / Bulk toggle */}
              <div className="flex items-center gap-4 p-1 bg-slate-100 rounded-xl">
                <button onClick={() => setExamIsBulkMode(false)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!examIsBulkMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'}`}>הזנה בודדת</button>
                <button onClick={() => setExamIsBulkMode(true)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${examIsBulkMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'}`}>הזנה מרובה</button>
              </div>

              {!examIsBulkMode ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">זיהוי השאלה</label>
                  <input
                    type="text" placeholder="למשל: שאלה 1, או תרגיל 5"
                    value={examExLocation} onChange={e => setExamExLocation(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm leading-relaxed">צור רשימת שאלות שייכנסו למבחן.</div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">מספרי שאלות (מופרדים בפסיק, רווח או אנטר)</label>
                    <textarea
                      placeholder={"לדוגמה:\n1, 2, 3\nאו\n1א\n1ב"}
                      value={examBulkList} onChange={e => setExamBulkList(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Topic selection */}
              {topics.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">שיוך לנושאים (אופציונלי)</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                    {topics.map(topic => (
                      <label key={topic.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={examSelectedTopics.includes(topic.id)}
                          onChange={() => setExamSelectedTopics(prev => prev.includes(topic.id) ? prev.filter(t => t !== topic.id) : [...prev, topic.id])}
                        />
                        <span className="text-sm text-slate-700">{topic.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => { setActiveExamIdForExercise(null); setExamExLocation(''); setExamBulkList(''); setExamSelectedTopics([]); setExamIsBulkMode(false); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleAddExerciseToExam}
                disabled={(!examIsBulkMode && !examExLocation.trim()) || (examIsBulkMode && !examBulkList.trim())}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                שמור שאלו{examIsBulkMode ? 'ת' : 'ה'} במבחן
              </button>
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
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
      />
    </div>
  );
};