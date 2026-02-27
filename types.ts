
export interface Goal {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  totalTopics: number;
  completedExercises: number;
  totalExercises: number;
}

export interface Topic {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  dueDate?: number | null; // Timestamp
}

export interface ChecklistItem {
  id: string;
  topicId: string;
  goalId: string;
  text: string;
  isCompleted: boolean;
  dueDate?: number | null; // Timestamp
  completedAt?: number | null; // Timestamp of when it was completed
}

export type ExerciseStatus = 'new' | 'green' | 'red';

export interface Exercise {
  id: string;
  topicId: string;
  goalId: string;
  location: string; // e.g. "Exam 2023 Q3"
  status: ExerciseStatus;
  lastAttemptedAt: number | null; // Timestamp
  nextReviewAt: number | null; // Timestamp
  consecutiveSuccesses: number;
  dueDate?: number | null; // Timestamp
}

export interface Attempt {
  id: string;
  exerciseId: string;
  result: 'success' | 'failure';
  timestamp: number;
}

export interface GeneratedPlan {
  topics: {
    title: string;
    description: string;
    exercises: {
      location: string;
    }[];
  }[];
}

export interface DailyStats {
  date: number; // Start-of-day timestamp
  exercisesReviewed: number;
  exercisesSucceeded: number;
  exercisesFailed: number;
  checklistCompleted: number;
  totalActivity: number; // exercisesReviewed + checklistCompleted
}

export interface ActivityFeedItem {
  id: string;
  type: 'attempt' | 'checklist';
  timestamp: number;
  description: string;
  result?: 'success' | 'failure'; // For attempts
}
