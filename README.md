# 📚 StudyPath — Smart Spaced-Repetition Study Tracker

> A full-stack web application that helps students track exercise progress, manage study goals, and master material through an intelligent spaced-repetition review system.

---

## 🚀 Overview

StudyPath is a personal study management platform built with **React + TypeScript** and powered by **Supabase** as a cloud back-end. It was designed for students preparing for exams who need a structured, data-driven way to track hundreds of exercises across multiple topics — and ensure nothing falls through the cracks.

The core idea: every exercise gets a **status** (new → in-progress → mastered) and a **next review date** calculated by a spaced-repetition algorithm. The app surfaces what to review today so you never have to guess what to study next.

---

## ✨ Key Features

### 🎯 Goal & Topic Management
- Create multiple study **Goals** (e.g., "Linear Algebra", "Data Structures")
- Organize each goal into **Topics** with optional due dates
- Per-goal progress bar showing the ratio of attempted exercises

### 📝 Exercise Tracking
- Add exercises to topics, individually or in bulk
- Group exercises into named **Exercise Groups** for better organization
- Categorize exam questions directly into an auto-created "Exam Questions" group
- Compact card grid view with status indicators (✓ mastered / ✗ needs review / ○ new)
- Filter exercises by status (All / Needs Review / To Complete)
- Edit and rename exercises and groups

### 🔁 Spaced-Repetition Review Sessions
- Automatically builds a **daily review queue** based on exercise history
- Mark each exercise as ✅ success (mastered, removed from queue) or ❌ failure (re-scheduled for the next day)
- Attempt history is persisted and drives the next-review calculation

### 📅 Weekly Planner
- 7-day view showing upcoming scheduled reviews per day, organized by goal and topic
- Overdue exercises are highlighted in red
- Shows total exercises due this week at a glance

### 📊 Daily Statistics & Streak Tracking
- Daily dashboard widget: exercises reviewed, checklist tasks completed, current streak
- Full statistics page with historical charts (exercises reviewed, success rate, consistency)
- Study streak counter for maintaining motivation

### 🏫 Exam View
- Dedicated view per exam to browse and manage associated exercises
- Questions from exams are categorized under a dedicated "Exam Questions" group in their topic

### 🔐 Authentication
- Secure sign-up / login via **Supabase Auth**
- All data is scoped per authenticated user
