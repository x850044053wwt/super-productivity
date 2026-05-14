export interface TaskTimeline {
  stages: TaskTimelineStage[];
}

export interface TaskTimelineStage {
  id: string;
  title: string;
  nodes: TaskTimelineNode[];
}

export interface TaskTimelineNode {
  id: string;
  title: string;
  startedAt?: number;
  completedAt?: number;
}

export type TaskTimelineNodeStatus = 'locked' | 'notStarted' | 'inProgress' | 'completed';
