import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPlan } from "../types";

// AI Features are disabled per user request. 
// Keeping this file structure valid to prevent TypeScript errors.

export const geminiService = {
  generateStudyPlan: async (goal: string): Promise<GeneratedPlan> => {
    // Return a basic stub since AI is disabled
    return {
        topics: []
    };
  }
};