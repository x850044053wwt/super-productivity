import {
  addNodeToStage,
  addStage,
  completeNode,
  deleteNode,
  deleteStage,
  getNodeStatus,
  getUnlockedStageId,
  isStageComplete,
  reopenNode,
  startNode,
  updateNodeTitle,
  updateStageTitle,
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

  it('adds a stage to an existing timeline without mutating the original timeline', () => {
    const result = addStage(timeline, 'D', 'stage-d');

    expect(result.stages.map((stage) => stage.id)).toEqual([
      'stage-a',
      'stage-b',
      'stage-c',
      'stage-d',
    ]);
    expect(timeline.stages.map((stage) => stage.id)).toEqual([
      'stage-a',
      'stage-b',
      'stage-c',
    ]);
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

  it('returns null when every stage is complete', () => {
    const result = completeNode(
      completeNode(
        completeNode(completeNode(timeline, 'node-a', 1000), 'node-b1', 2000),
        'node-b2',
        3000,
      ),
      'node-c',
      4000,
    );

    expect(getUnlockedStageId(result)).toBeNull();
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

  it('reports unknown nodes as locked', () => {
    expect(getNodeStatus(timeline, 'missing-node')).toBe('locked');
  });

  it('reports completed nodes as completed even when their stage is locked', () => {
    const result: TaskTimeline = {
      stages: [
        timeline.stages[0],
        timeline.stages[1],
        {
          ...timeline.stages[2],
          nodes: [{ ...timeline.stages[2].nodes[0], completedAt: 1000 }],
        },
      ],
    };

    expect(getNodeStatus(result, 'node-c')).toBe('completed');
  });

  it('reports empty stages as incomplete', () => {
    expect(isStageComplete({ id: 'empty-stage', title: 'Empty', nodes: [] })).toBe(false);
  });

  it('records startedAt when a node starts', () => {
    const result = startNode(timeline, 'node-a', 1234);

    expect(result.stages[0].nodes[0].startedAt).toBe(1234);
    expect(result.stages[0].nodes[0].completedAt).toBeUndefined();
    expect(timeline.stages[0].nodes[0].startedAt).toBeUndefined();
  });

  it('does not start completed nodes', () => {
    const completed = completeNode(timeline, 'node-a', 1234);

    expect(startNode(completed, 'node-a', 2345)).toBe(completed);
  });

  it('records both timestamps when completing a node that was never started', () => {
    const result = completeNode(timeline, 'node-a', 1234);

    expect(result.stages[0].nodes[0].startedAt).toBe(1234);
    expect(result.stages[0].nodes[0].completedAt).toBe(1234);
    expect(timeline.stages[0].nodes[0].startedAt).toBeUndefined();
    expect(timeline.stages[0].nodes[0].completedAt).toBeUndefined();
    expect(isStageComplete(result.stages[0])).toBe(true);
  });

  it('preserves startedAt when completing a node that was already started', () => {
    const started = startNode(timeline, 'node-a', 1234);
    const completed = completeNode(started, 'node-a', 2345);

    expect(completed.stages[0].nodes[0].startedAt).toBe(1234);
    expect(completed.stages[0].nodes[0].completedAt).toBe(2345);
  });

  it('does not complete already completed nodes again', () => {
    const completed = completeNode(timeline, 'node-a', 1234);

    expect(completeNode(completed, 'node-a', 2345)).toBe(completed);
    expect(completed.stages[0].nodes[0].completedAt).toBe(1234);
  });

  it('reopens a completed node by clearing completedAt only', () => {
    const completed = completeNode(timeline, 'node-a', 1234);
    const reopened = reopenNode(completed, 'node-a');

    expect(reopened.stages[0].nodes[0].startedAt).toBe(1234);
    expect(reopened.stages[0].nodes[0].completedAt).toBeUndefined();
    expect(completed.stages[0].nodes[0].completedAt).toBe(1234);
  });

  it('does not reopen nodes that are not completed', () => {
    expect(reopenNode(timeline, 'node-a')).toBe(timeline);
  });

  it('does not start locked nodes', () => {
    expect(startNode(timeline, 'node-c', 1234)).toBe(timeline);
  });

  it('does not complete locked nodes', () => {
    expect(completeNode(timeline, 'node-c', 1234)).toBe(timeline);
  });

  it('updates stage and node titles immutably', () => {
    const renamedStage = updateStageTitle(timeline, 'stage-b', 'Parallel checks');
    const renamedNode = updateNodeTitle(renamedStage, 'node-b1', 'Validate sample set');

    expect(renamedNode.stages[1].title).toBe('Parallel checks');
    expect(renamedNode.stages[1].nodes[0].title).toBe('Validate sample set');
    expect(timeline.stages[1].title).toBe('B');
    expect(timeline.stages[1].nodes[0].title).toBe('Validate samples');
  });

  it('deletes nodes and stages immutably', () => {
    const withoutNode = deleteNode(timeline, 'node-b1');
    const withoutStage = deleteStage(withoutNode, 'stage-c');

    expect(withoutNode.stages[1].nodes.map((node) => node.id)).toEqual(['node-b2']);
    expect(withoutStage.stages.map((stage) => stage.id)).toEqual(['stage-a', 'stage-b']);
    expect(timeline.stages.map((stage) => stage.id)).toEqual([
      'stage-a',
      'stage-b',
      'stage-c',
    ]);
  });
});
