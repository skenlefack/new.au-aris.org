export interface LearnerProgressEntity {
  id: string;
  userId: string;
  moduleId: string;
  completedLessons: unknown; // JSON array of lesson IDs
  score: number | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
