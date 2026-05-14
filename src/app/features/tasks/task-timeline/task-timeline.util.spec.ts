import {
  addNodeToStage,
  addStage,
  completeNode,
  getNodeStatus,
  getUnlockedStageId,
  isStageComplete,
  reopenNode,
  startNode,
} from './task-timeline.util';
import { TaskTimeline } from './task-timeline.model';

describe('task timeline utilities', () => {
  const timeline: TaskTimeline = {
    stages: [
      {
        id: 'stage-a',
        title: 'A',
        nodes: [{ id: 'node-a', title: 'Collect context' }],
      },
      {
        id: 'stage-b',
        title: 'B',
        nodes: [
          { id: 'node-b1', title: 'Validate samples' },
          { id: 'node-b2', title: 'Compare logs' },
        ],
      },
      {
        id: 'stage-c',
        title: 'C',
        nodes: [{ id: 'node-c', title: 'Write summary' }],
      },
    ],
  };

  it('adds the first stage to an empty timeline', () => {
    expect(addStage(undefined, 'A', 'stage-a')).toEqual({
      stages: [{ id: 'stage-a', title: 'A', nodes: [] }],
    });
  });

  it('adds a node to an existing stage without mutating the original timeline', () => {
    const result = addNodeToStage(timeline, 'stage-b', 'New check', 'node-b3');

    expect(result.stages[1].nodes.map((node) => node.id)).toEqual([
      'node-b1',
      'node-b2',
      'node-b3',
    ]);
    expect(timeline.stages[1].nodes.map((node) => node.id)).toEqual([
      'node-b1',
      'node-b2',
    ]);
  });

  it('unlocks only the first incomplete stage', () => {
    expect(getUnlockedStageId(timeline)).toBe('stage-a');
  });

  it('allows multiple nodes in one unlocked stage to be in progress together', () => {
    const afterA = completeNode(timeline, 'node-a', 1000);
    const afterB1 = startNode(afterA, 'node-b1', 2000);
    const afterB2 = startNode(afterB1, 'node-b2', 3000);

    expect(getNodeStatus(afterB2, 'node-b1')).toBe('inProgress');
    expect(getNodeStatus(afterB2, 'node-b2')).toBe('inProgress');
  });

  it('keeps later stages locked until every previous-stage node is complete', () => {
    const withAComplete = completeNode(timeline, 'node-a', 1000);
    const withB1Complete = completeNode(withAComplete, 'node-b1', 2000);

    expect(getUnlockedStageId(withB1Complete)).toBe('stage-b');
    expect(getNodeStatus(withB1Complete, 'node-c')).toBe('locked');

    const withB2Complete = completeNode(withB1Complete, 'node-b2', 3000);

    expect(getUnlockedStageId(withB2Complete)).toBe('stage-c');
    expect(getNodeStatus(withB2Complete, 'node-c')).toBe('notStarted');
  });

  it('records startedAt when a node starts', () => {
    const result = startNode(timeline, 'node-a', 1234);

    expect(result.stages[0].nodes[0].startedAt).toBe(1234);
    expect(result.stages[0].nodes[0].completedAt).toBeUndefined();
  });

  it('records both timestamps when completing a node that was never started', () => {
    const result = completeNode(timeline, 'node-a', 1234);

    expect(result.stages[0].nodes[0].startedAt).toBe(1234);
    expect(result.stages[0].nodes[0].completedAt).toBe(1234);
    expect(isStageComplete(result.stages[0])).toBe(true);
  });

  it('reopens a completed node by clearing completedAt only', () => {
    const completed = completeNode(timeline, 'node-a', 1234);
    const reopened = reopenNode(completed, 'node-a');

    expect(reopened.stages[0].nodes[0].startedAt).toBe(1234);
    expect(reopened.stages[0].nodes[0].completedAt).toBeUndefined();
  });

  it('does not start locked nodes', () => {
    expect(startNode(timeline, 'node-c', 1234)).toBe(timeline);
  });
});
