import {
  TaskTimeline,
  TaskTimelineNode,
  TaskTimelineNodeStatus,
  TaskTimelineStage,
} from './task-timeline.model';

export const isStageComplete = (stage: TaskTimelineStage): boolean =>
  stage.nodes.length > 0 && stage.nodes.every((node) => node.completedAt !== undefined);

export const getUnlockedStageId = (timeline: TaskTimeline): string | null =>
  timeline.stages.find((stage) => !isStageComplete(stage))?.id ?? null;

export const getNodeStatus = (
  timeline: TaskTimeline,
  nodeId: string,
): TaskTimelineNodeStatus => {
  const unlockedStageId = getUnlockedStageId(timeline);

  for (const stage of timeline.stages) {
    const node = stage.nodes.find(({ id }) => id === nodeId);

    if (!node) {
      continue;
    }

    if (node.completedAt !== undefined) {
      return 'completed';
    }

    if (stage.id !== unlockedStageId) {
      return 'locked';
    }

    return node.startedAt === undefined ? 'notStarted' : 'inProgress';
  }

  return 'locked';
};

export const addStage = (
  timeline: TaskTimeline | undefined,
  title: string,
  id: string,
): TaskTimeline => ({
  stages: [...(timeline?.stages ?? []), { id, title, nodes: [] }],
});

export const addNodeToStage = (
  timeline: TaskTimeline,
  stageId: string,
  title: string,
  id: string,
): TaskTimeline => {
  let didUpdate = false;
  const stages = timeline.stages.map((stage) => {
    if (stage.id !== stageId) {
      return stage;
    }

    didUpdate = true;
    return {
      ...stage,
      nodes: [...stage.nodes, { id, title }],
    };
  });

  return didUpdate ? { ...timeline, stages } : timeline;
};

export const startNode = (
  timeline: TaskTimeline,
  nodeId: string,
  timestamp: number,
): TaskTimeline => {
  const status = getNodeStatus(timeline, nodeId);

  if (status === 'locked' || status === 'completed') {
    return timeline;
  }

  return updateNode(timeline, nodeId, (node) =>
    node.startedAt === undefined ? { ...node, startedAt: timestamp } : node,
  );
};

export const completeNode = (
  timeline: TaskTimeline,
  nodeId: string,
  timestamp: number,
): TaskTimeline => {
  if (getNodeStatus(timeline, nodeId) === 'locked') {
    return timeline;
  }

  return updateNode(timeline, nodeId, (node) => ({
    ...node,
    startedAt: node.startedAt ?? timestamp,
    completedAt: timestamp,
  }));
};

export const reopenNode = (timeline: TaskTimeline, nodeId: string): TaskTimeline =>
  updateNode(timeline, nodeId, ({ completedAt, ...node }) => node);

const updateNode = (
  timeline: TaskTimeline,
  nodeId: string,
  update: (node: TaskTimelineNode) => TaskTimelineNode,
): TaskTimeline => {
  let didUpdate = false;
  const stages = timeline.stages.map((stage) => {
    const nodeIndex = stage.nodes.findIndex(({ id }) => id === nodeId);

    if (nodeIndex === -1) {
      return stage;
    }

    const updatedNode = update(stage.nodes[nodeIndex]);

    if (updatedNode === stage.nodes[nodeIndex]) {
      return stage;
    }

    didUpdate = true;
    return {
      ...stage,
      nodes: [
        ...stage.nodes.slice(0, nodeIndex),
        updatedNode,
        ...stage.nodes.slice(nodeIndex + 1),
      ],
    };
  });

  return didUpdate ? { ...timeline, stages } : timeline;
};
