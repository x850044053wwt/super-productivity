# Task Timeline DAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a synchronized stage-based timeline DAG inside a single task, separate from subtasks.

**Architecture:** Store timeline data as an optional field on `TaskCopy`. Keep all graph rules in pure helpers under `src/app/features/tasks/task-timeline/`, and let a standalone task-detail panel component render and edit that data through `TaskService.update`. The graph is constrained to ordered stages with parallel nodes inside each stage.

**Tech Stack:** Angular standalone components, NgRx task updates, Jasmine/Karma unit tests, Angular Material buttons/icons/tooltips, existing Super Productivity i18n via `T` and `en.json`.

---

## File Structure

- Create `src/app/features/tasks/task-timeline/task-timeline.model.ts`
  - Owns timeline interfaces and node status type.
- Create `src/app/features/tasks/task-timeline/task-timeline.util.ts`
  - Owns immutable timeline edits, gating rules, and status helpers.
- Create `src/app/features/tasks/task-timeline/task-timeline.util.spec.ts`
  - Tests the stage-DAG behavior before UI work.
- Create `src/app/features/tasks/task-timeline/task-timeline.component.ts`
  - Standalone panel content component. Inputs: `timeline`. Output: `timelineChange`.
- Create `src/app/features/tasks/task-timeline/task-timeline.component.html`
  - Compact stage list editor.
- Create `src/app/features/tasks/task-timeline/task-timeline.component.scss`
  - Scoped panel styles using existing CSS variables.
- Create `src/app/features/tasks/task-timeline/task-timeline.component.spec.ts`
  - UI tests for locked/start/complete behavior and emitted timeline updates.
- Modify `src/app/features/tasks/task.model.ts`
  - Add `timeline?: TaskTimeline` to `TaskCopy`.
- Modify `src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts`
  - Verify task updates preserve the new timeline field.
- Modify `src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts`
  - Import `TaskTimelineComponent` and add `updateTimeline()`.
- Modify `src/app/features/tasks/task-detail-panel/task-detail-panel.component.html`
  - Render timeline as its own `task-detail-item` panel.
- Modify `src/app/t.const.ts`
  - Add translation constants under `F.TASK.ADDITIONAL_INFO`.
- Modify `src/assets/i18n/en.json`
  - Add English strings for timeline controls and statuses.
- Modify `docs/wiki/4.09-Task-Attributes.md`
  - Document the new task timeline attribute.

---

## Task 1: Timeline Model And Pure Helpers

**Files:**
- Create: `src/app/features/tasks/task-timeline/task-timeline.model.ts`
- Create: `src/app/features/tasks/task-timeline/task-timeline.util.ts`
- Create: `src/app/features/tasks/task-timeline/task-timeline.util.spec.ts`

- [ ] **Step 1: Write the failing helper spec**

Create `src/app/features/tasks/task-timeline/task-timeline.util.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the helper spec to verify RED**

Run:

```bash
npm run test:file src/app/features/tasks/task-timeline/task-timeline.util.spec.ts
```

Expected: FAIL with an import/module error because `task-timeline.util.ts` and `task-timeline.model.ts` do not exist.

- [ ] **Step 3: Add the timeline model**

Create `src/app/features/tasks/task-timeline/task-timeline.model.ts`:

```ts
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

export type TaskTimelineNodeStatus =
  | 'locked'
  | 'notStarted'
  | 'inProgress'
  | 'completed';
```

- [ ] **Step 4: Add the minimal helper implementation**

Create `src/app/features/tasks/task-timeline/task-timeline.util.ts`:

```ts
import {
  TaskTimeline,
  TaskTimelineNode,
  TaskTimelineNodeStatus,
  TaskTimelineStage,
} from './task-timeline.model';

const emptyTimeline = (): TaskTimeline => ({ stages: [] });

const mapNode = (
  timeline: TaskTimeline | undefined,
  nodeId: string,
  fn: (node: TaskTimelineNode, isLocked: boolean) => TaskTimelineNode,
): TaskTimeline => {
  const source = timeline || emptyTimeline();
  return {
    stages: source.stages.map((stage) => ({
      ...stage,
      nodes: stage.nodes.map((node) =>
        node.id === nodeId ? fn(node, getUnlockedStageId(source) !== stage.id) : node,
      ),
    })),
  };
};

export const isStageComplete = (stage: TaskTimelineStage): boolean =>
  stage.nodes.length > 0 && stage.nodes.every((node) => !!node.completedAt);

export const getUnlockedStageId = (timeline: TaskTimeline | undefined): string | null => {
  const stages = timeline?.stages || [];
  const unlockedStage = stages.find((stage) => !isStageComplete(stage));
  return unlockedStage?.id || null;
};

export const getNodeStatus = (
  timeline: TaskTimeline | undefined,
  nodeId: string,
): TaskTimelineNodeStatus => {
  const stages = timeline?.stages || [];
  const unlockedStageId = getUnlockedStageId(timeline);

  for (const stage of stages) {
    const node = stage.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) continue;
    if (node.completedAt) return 'completed';
    if (stage.id !== unlockedStageId) return 'locked';
    if (node.startedAt) return 'inProgress';
    return 'notStarted';
  }

  return 'locked';
};

export const addStage = (
  timeline: TaskTimeline | undefined,
  title: string,
  id: string,
): TaskTimeline => ({
  stages: [...(timeline?.stages || []), { id, title, nodes: [] }],
});

export const addNodeToStage = (
  timeline: TaskTimeline | undefined,
  stageId: string,
  title: string,
  id: string,
): TaskTimeline => {
  const source = timeline || emptyTimeline();
  return {
    stages: source.stages.map((stage) =>
      stage.id === stageId
        ? { ...stage, nodes: [...stage.nodes, { id, title }] }
        : stage,
    ),
  };
};

export const startNode = (
  timeline: TaskTimeline | undefined,
  nodeId: string,
  timestamp: number,
): TaskTimeline => {
  const source = timeline || emptyTimeline();
  const status = getNodeStatus(source, nodeId);
  if (status === 'locked' || status === 'completed') return source;

  return mapNode(source, nodeId, (node, isLocked) =>
    isLocked ? node : { ...node, startedAt: node.startedAt || timestamp },
  );
};

export const completeNode = (
  timeline: TaskTimeline | undefined,
  nodeId: string,
  timestamp: number,
): TaskTimeline => {
  const source = timeline || emptyTimeline();
  const status = getNodeStatus(source, nodeId);
  if (status === 'locked') return source;

  return mapNode(source, nodeId, (node, isLocked) =>
    isLocked
      ? node
      : {
          ...node,
          startedAt: node.startedAt || timestamp,
          completedAt: timestamp,
        },
  );
};

export const reopenNode = (
  timeline: TaskTimeline | undefined,
  nodeId: string,
): TaskTimeline =>
  mapNode(timeline, nodeId, (node) => {
    const { completedAt, ...rest } = node;
    return rest;
  });
```

- [ ] **Step 5: Run the helper spec to verify GREEN**

Run:

```bash
npm run test:file src/app/features/tasks/task-timeline/task-timeline.util.spec.ts
```

Expected: PASS for all tests in `task-timeline.util.spec.ts`.

- [ ] **Step 6: Run file checks for helper files**

Run:

```bash
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.model.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.util.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.util.spec.ts
```

Expected: each command exits 0.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add src/app/features/tasks/task-timeline/task-timeline.model.ts src/app/features/tasks/task-timeline/task-timeline.util.ts src/app/features/tasks/task-timeline/task-timeline.util.spec.ts
git commit -m "feat(tasks): add timeline helpers"
```

---

## Task 2: Task Model And i18n Surface

**Files:**
- Modify: `src/app/features/tasks/task.model.ts`
- Modify: `src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts`
- Modify: `src/app/t.const.ts`
- Modify: `src/assets/i18n/en.json`

- [ ] **Step 1: Write a failing task model spec**

Append this test to `src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts` inside the existing top-level `describe('updateTask action', ...)` block that defines `createUpdateTaskAction`:

```ts
  it('should preserve timeline data on task update', () => {
    const testState = createStateWithExistingTasks(['task1'], [], ['task1']);
    const action = createUpdateTaskAction('task1', {
      timeline: {
        stages: [
          {
            id: 'stage-a',
            title: 'A',
            nodes: [
              {
                id: 'node-a',
                title: 'Collect context',
                startedAt: 1000,
                completedAt: 2000,
              },
            ],
          },
        ],
      },
    });

    metaReducer(testState, action);

    expectStateUpdate(
      {
        ...expectTaskUpdate('task1', {
          timeline: {
            stages: [
              {
                id: 'stage-a',
                title: 'A',
                nodes: [
                  {
                    id: 'node-a',
                    title: 'Collect context',
                    startedAt: 1000,
                    completedAt: 2000,
                  },
                ],
              },
            ],
          },
        }),
      },
      action,
      mockReducer,
      testState,
    );
  });
```

- [ ] **Step 2: Run the reducer spec to verify RED**

Run:

```bash
npm run test:file src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts
```

Expected: FAIL with a TypeScript error that `timeline` is not assignable to `Partial<Task>`.

- [ ] **Step 3: Add timeline to the task model**

Modify `src/app/features/tasks/task.model.ts`:

```ts
import { TaskTimeline } from './task-timeline/task-timeline.model';
```

Add this optional field inside `TaskCopy` near the other app-specific fields:

```ts
  timeline?: TaskTimeline;
```

- [ ] **Step 4: Add translation constants**

Modify the `ADDITIONAL_INFO` object in `src/app/t.const.ts`:

```ts
        TIMELINE: 'F.TASK.ADDITIONAL_INFO.TIMELINE',
        TIMELINE_ADD_NODE: 'F.TASK.ADDITIONAL_INFO.TIMELINE_ADD_NODE',
        TIMELINE_ADD_STAGE: 'F.TASK.ADDITIONAL_INFO.TIMELINE_ADD_STAGE',
        TIMELINE_COMPLETE_NODE: 'F.TASK.ADDITIONAL_INFO.TIMELINE_COMPLETE_NODE',
        TIMELINE_DELETE_NODE: 'F.TASK.ADDITIONAL_INFO.TIMELINE_DELETE_NODE',
        TIMELINE_DELETE_STAGE: 'F.TASK.ADDITIONAL_INFO.TIMELINE_DELETE_STAGE',
        TIMELINE_EMPTY: 'F.TASK.ADDITIONAL_INFO.TIMELINE_EMPTY',
        TIMELINE_NODE_COMPLETED: 'F.TASK.ADDITIONAL_INFO.TIMELINE_NODE_COMPLETED',
        TIMELINE_NODE_IN_PROGRESS:
          'F.TASK.ADDITIONAL_INFO.TIMELINE_NODE_IN_PROGRESS',
        TIMELINE_NODE_LOCKED: 'F.TASK.ADDITIONAL_INFO.TIMELINE_NODE_LOCKED',
        TIMELINE_NODE_NOT_STARTED:
          'F.TASK.ADDITIONAL_INFO.TIMELINE_NODE_NOT_STARTED',
        TIMELINE_REOPEN_NODE: 'F.TASK.ADDITIONAL_INFO.TIMELINE_REOPEN_NODE',
        TIMELINE_START_NODE: 'F.TASK.ADDITIONAL_INFO.TIMELINE_START_NODE',
```

- [ ] **Step 5: Add English translations**

Modify `src/assets/i18n/en.json` under `F.TASK.ADDITIONAL_INFO`:

```json
        "TIMELINE": "Timeline",
        "TIMELINE_ADD_NODE": "Add node",
        "TIMELINE_ADD_STAGE": "Add stage",
        "TIMELINE_COMPLETE_NODE": "Complete",
        "TIMELINE_DELETE_NODE": "Delete node",
        "TIMELINE_DELETE_STAGE": "Delete stage",
        "TIMELINE_EMPTY": "No timeline nodes yet",
        "TIMELINE_NODE_COMPLETED": "Completed",
        "TIMELINE_NODE_IN_PROGRESS": "In progress",
        "TIMELINE_NODE_LOCKED": "Locked",
        "TIMELINE_NODE_NOT_STARTED": "Not started",
        "TIMELINE_REOPEN_NODE": "Reopen",
        "TIMELINE_START_NODE": "Start",
```

- [ ] **Step 6: Run the reducer spec to verify GREEN**

Run:

```bash
npm run test:file src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts
```

Expected: PASS for `should preserve timeline data on task update`.

- [ ] **Step 7: Run file checks**

Run:

```bash
npm run checkFile src/app/features/tasks/task.model.ts
npm run checkFile src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts
npm run checkFile src/app/t.const.ts
```

Expected: each command exits 0.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add src/app/features/tasks/task.model.ts src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts src/app/t.const.ts src/assets/i18n/en.json
git commit -m "feat(tasks): add timeline task field"
```

---

## Task 3: Timeline Component

**Files:**
- Create: `src/app/features/tasks/task-timeline/task-timeline.component.ts`
- Create: `src/app/features/tasks/task-timeline/task-timeline.component.html`
- Create: `src/app/features/tasks/task-timeline/task-timeline.component.scss`
- Create: `src/app/features/tasks/task-timeline/task-timeline.component.spec.ts`
- Modify: `src/app/features/tasks/task-timeline/task-timeline.util.ts`
- Modify: `src/app/features/tasks/task-timeline/task-timeline.util.spec.ts`

- [ ] **Step 1: Extend helper specs for delete and title updates**

Append these tests to `src/app/features/tasks/task-timeline/task-timeline.util.spec.ts`:

```ts
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
    expect(withoutStage.stages.map((stage) => stage.id)).toEqual([
      'stage-a',
      'stage-b',
    ]);
    expect(timeline.stages.map((stage) => stage.id)).toEqual([
      'stage-a',
      'stage-b',
      'stage-c',
    ]);
  });
```

Also update the import list:

```ts
  deleteNode,
  deleteStage,
  updateNodeTitle,
  updateStageTitle,
```

- [ ] **Step 2: Run the helper spec to verify RED**

Run:

```bash
npm run test:file src/app/features/tasks/task-timeline/task-timeline.util.spec.ts
```

Expected: FAIL because `deleteNode`, `deleteStage`, `updateNodeTitle`, and `updateStageTitle` are not exported.

- [ ] **Step 3: Implement title and delete helpers**

Append to `src/app/features/tasks/task-timeline/task-timeline.util.ts`:

```ts
export const updateStageTitle = (
  timeline: TaskTimeline | undefined,
  stageId: string,
  title: string,
): TaskTimeline => {
  const source = timeline || emptyTimeline();
  return {
    stages: source.stages.map((stage) =>
      stage.id === stageId ? { ...stage, title } : stage,
    ),
  };
};

export const updateNodeTitle = (
  timeline: TaskTimeline | undefined,
  nodeId: string,
  title: string,
): TaskTimeline =>
  mapNode(timeline, nodeId, (node) => ({
    ...node,
    title,
  }));

export const deleteStage = (
  timeline: TaskTimeline | undefined,
  stageId: string,
): TaskTimeline => ({
  stages: (timeline?.stages || []).filter((stage) => stage.id !== stageId),
});

export const deleteNode = (
  timeline: TaskTimeline | undefined,
  nodeId: string,
): TaskTimeline => ({
  stages: (timeline?.stages || []).map((stage) => ({
    ...stage,
    nodes: stage.nodes.filter((node) => node.id !== nodeId),
  })),
});
```

- [ ] **Step 4: Run the helper spec to verify GREEN**

Run:

```bash
npm run test:file src/app/features/tasks/task-timeline/task-timeline.util.spec.ts
```

Expected: PASS for all timeline utility tests.

- [ ] **Step 5: Write the failing component spec**

Create `src/app/features/tasks/task-timeline/task-timeline.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { TaskTimelineComponent } from './task-timeline.component';
import { TaskTimeline } from './task-timeline.model';

describe('TaskTimelineComponent', () => {
  let fixture: ComponentFixture<TaskTimelineComponent>;
  let component: TaskTimelineComponent;

  const timeline: TaskTimeline = {
    stages: [
      {
        id: 'stage-a',
        title: 'A',
        nodes: [
          {
            id: 'node-a',
            title: 'Collect context',
            startedAt: 1000,
            completedAt: 1000,
          },
        ],
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, TranslateModule.forRoot(), TaskTimelineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskTimelineComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('timeline', timeline);
    fixture.detectChanges();
  });

  it('renders stages and nodes', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('A');
    expect(text).toContain('B');
    expect(text).toContain('C');
    expect(text).toContain('Validate samples');
    expect(text).toContain('Compare logs');
  });

  it('does not emit when trying to start a locked node', () => {
    spyOn(component.timelineChange, 'emit');

    component.start('node-c');

    expect(component.timelineChange.emit).not.toHaveBeenCalled();
  });

  it('emits an updated timeline when starting an unlocked node', () => {
    spyOn(component.timelineChange, 'emit');

    component.start('node-b1');

    expect(component.timelineChange.emit).toHaveBeenCalled();
    const emitted = (component.timelineChange.emit as jasmine.Spy).calls.mostRecent()
      .args[0] as TaskTimeline;
    expect(emitted.stages[1].nodes[0].startedAt).toEqual(jasmine.any(Number));
  });

  it('unlocks the next stage after every current stage node is complete', () => {
    let emitted: TaskTimeline | undefined;
    spyOn(component.timelineChange, 'emit').and.callFake((value: TaskTimeline) => {
      emitted = value;
      fixture.componentRef.setInput('timeline', value);
      fixture.detectChanges();
    });

    component.complete('node-b1');
    component.complete('node-b2');

    expect(emitted?.stages[2].nodes[0].completedAt).toBeUndefined();
    expect(component.nodeStatus('node-c')).toBe('notStarted');
  });
});
```

- [ ] **Step 6: Run the component spec to verify RED**

Run:

```bash
npm run test:file src/app/features/tasks/task-timeline/task-timeline.component.spec.ts
```

Expected: FAIL because `TaskTimelineComponent` does not exist.

- [ ] **Step 7: Implement the component TypeScript**

Create `src/app/features/tasks/task-timeline/task-timeline.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { nanoid } from 'nanoid';
import { T } from '../../../t.const';
import { TaskTimeline, TaskTimelineNodeStatus } from './task-timeline.model';
import {
  addNodeToStage,
  addStage,
  completeNode,
  deleteNode,
  deleteStage,
  getNodeStatus,
  reopenNode,
  startNode,
  updateNodeTitle,
  updateStageTitle,
} from './task-timeline.util';

@Component({
  selector: 'task-timeline',
  templateUrl: './task-timeline.component.html',
  styleUrls: ['./task-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButton, MatIconButton, MatIcon, MatTooltip, TranslatePipe],
})
export class TaskTimelineComponent {
  readonly timeline = input<TaskTimeline | undefined>();
  readonly timelineChange = output<TaskTimeline>();

  readonly T = T;

  nodeStatus(nodeId: string): TaskTimelineNodeStatus {
    return getNodeStatus(this.timeline(), nodeId);
  }

  addStage(): void {
    this.timelineChange.emit(addStage(this.timeline(), 'Stage', nanoid()));
  }

  addNode(stageId: string): void {
    this.timelineChange.emit(addNodeToStage(this.timeline(), stageId, 'Node', nanoid()));
  }

  updateStageTitle(stageId: string, title: string): void {
    this.timelineChange.emit(updateStageTitle(this.timeline(), stageId, title));
  }

  updateNodeTitle(nodeId: string, title: string): void {
    this.timelineChange.emit(updateNodeTitle(this.timeline(), nodeId, title));
  }

  deleteStage(stageId: string): void {
    this.timelineChange.emit(deleteStage(this.timeline(), stageId));
  }

  deleteNode(nodeId: string): void {
    this.timelineChange.emit(deleteNode(this.timeline(), nodeId));
  }

  start(nodeId: string): void {
    const updated = startNode(this.timeline(), nodeId, Date.now());
    if (updated !== this.timeline()) {
      this.timelineChange.emit(updated);
    }
  }

  complete(nodeId: string): void {
    const updated = completeNode(this.timeline(), nodeId, Date.now());
    if (updated !== this.timeline()) {
      this.timelineChange.emit(updated);
    }
  }

  reopen(nodeId: string): void {
    this.timelineChange.emit(reopenNode(this.timeline(), nodeId));
  }
}
```

- [ ] **Step 8: Implement the component template**

Create `src/app/features/tasks/task-timeline/task-timeline.component.html`:

```html
<div class="timeline">
  @if (!timeline()?.stages?.length) {
    <p class="empty">{{ T.F.TASK.ADDITIONAL_INFO.TIMELINE_EMPTY | translate }}</p>
  }

  @for (stage of timeline()?.stages || []; track stage.id) {
    <section class="stage">
      <header class="stage-header">
        <input
          [value]="stage.title"
          (change)="updateStageTitle(stage.id, $any($event.target).value)"
          class="title-input"
        />
        <div class="stage-actions">
          <button
            mat-icon-button
            type="button"
            (click)="addNode(stage.id)"
            [matTooltip]="T.F.TASK.ADDITIONAL_INFO.TIMELINE_ADD_NODE | translate"
          >
            <mat-icon>add</mat-icon>
          </button>
          <button
            mat-icon-button
            type="button"
            (click)="deleteStage(stage.id)"
            [matTooltip]="T.F.TASK.ADDITIONAL_INFO.TIMELINE_DELETE_STAGE | translate"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </header>

      <div class="nodes">
        @for (node of stage.nodes; track node.id) {
          <article
            class="node"
            [class.is-completed]="nodeStatus(node.id) === 'completed'"
            [class.is-in-progress]="nodeStatus(node.id) === 'inProgress'"
            [class.is-locked]="nodeStatus(node.id) === 'locked'"
          >
            <mat-icon class="node-state-icon">
              {{
                nodeStatus(node.id) === 'completed'
                  ? 'check_circle'
                  : nodeStatus(node.id) === 'inProgress'
                    ? 'play_circle'
                    : nodeStatus(node.id) === 'locked'
                      ? 'lock'
                      : 'radio_button_unchecked'
              }}
            </mat-icon>

            <div class="node-main">
              <input
                [value]="node.title"
                (change)="updateNodeTitle(node.id, $any($event.target).value)"
                class="title-input"
              />
              <div class="node-meta">
                @if (node.startedAt) {
                  <span>{{ node.startedAt | date: 'shortTime' }}</span>
                }
                @if (node.completedAt) {
                  <span>{{ node.completedAt | date: 'shortTime' }}</span>
                }
              </div>
            </div>

            <div class="node-actions">
              @if (nodeStatus(node.id) === 'notStarted') {
                <button
                  mat-icon-button
                  type="button"
                  (click)="start(node.id)"
                  [matTooltip]="T.F.TASK.ADDITIONAL_INFO.TIMELINE_START_NODE | translate"
                >
                  <mat-icon>play_arrow</mat-icon>
                </button>
              }
              @if (nodeStatus(node.id) === 'inProgress') {
                <button
                  mat-icon-button
                  type="button"
                  (click)="complete(node.id)"
                  [matTooltip]="
                    T.F.TASK.ADDITIONAL_INFO.TIMELINE_COMPLETE_NODE | translate
                  "
                >
                  <mat-icon>check</mat-icon>
                </button>
              }
              @if (nodeStatus(node.id) === 'completed') {
                <button
                  mat-icon-button
                  type="button"
                  (click)="reopen(node.id)"
                  [matTooltip]="T.F.TASK.ADDITIONAL_INFO.TIMELINE_REOPEN_NODE | translate"
                >
                  <mat-icon>undo</mat-icon>
                </button>
              }
              <button
                mat-icon-button
                type="button"
                (click)="deleteNode(node.id)"
                [matTooltip]="T.F.TASK.ADDITIONAL_INFO.TIMELINE_DELETE_NODE | translate"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </article>
        }
      </div>
    </section>
  }

  <div class="timeline-footer">
    <button
      mat-button
      type="button"
      (click)="addStage()"
    >
      <mat-icon>add</mat-icon>
      <span>{{ T.F.TASK.ADDITIONAL_INFO.TIMELINE_ADD_STAGE | translate }}</span>
    </button>
  </div>
</div>
```

- [ ] **Step 9: Confirm Angular pipe imports are present**

Confirm that `src/app/features/tasks/task-timeline/task-timeline.component.ts` imports `DatePipe`:

```ts
import { DatePipe } from '@angular/common';
```

Confirm that the component `imports` array includes `DatePipe`:

```ts
  imports: [
    DatePipe,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    TranslatePipe,
  ],
```

- [ ] **Step 10: Implement component styles**

Create `src/app/features/tasks/task-timeline/task-timeline.component.scss`:

```scss
@use '../../../../styles/_globals.scss' as *;

:host {
  display: block;
}

.timeline {
  display: grid;
  gap: var(--s);
}

.empty {
  margin: var(--s);
  color: var(--text-color-muted);
}

.stage {
  border: 1px solid var(--extra-border-color);
  border-radius: var(--card-border-radius);
  background: var(--bg-lightest);
  overflow: hidden;
}

.stage-header,
.node {
  display: grid;
  align-items: center;
  gap: var(--s-half);
}

.stage-header {
  grid-template-columns: minmax(0, 1fr) auto;
  padding: var(--s-half) var(--s);
  background: var(--task-detail-bg);
  border-bottom: 1px solid var(--extra-border-color);
}

.stage-actions,
.node-actions {
  display: flex;
  align-items: center;
}

.nodes {
  display: grid;
  gap: 1px;
}

.node {
  grid-template-columns: 24px minmax(0, 1fr) auto;
  min-height: 44px;
  padding: var(--s-half) var(--s);
  background: var(--task-detail-bg);

  &.is-locked {
    opacity: 0.56;
  }

  &.is-completed .node-state-icon {
    color: var(--c-primary);
  }

  &.is-in-progress .node-state-icon {
    color: var(--c-accent);
  }
}

.node-main {
  min-width: 0;
}

.node-meta {
  display: flex;
  gap: var(--s-half);
  min-height: 16px;
  color: var(--text-color-muted);
  font-size: 11px;
}

.title-input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-color);
  font: inherit;
  font-weight: 600;
  outline: 0;
}

.node .title-input {
  font-weight: 400;
}

.timeline-footer {
  text-align: center;
}
```

- [ ] **Step 11: Run the component spec to verify GREEN**

Run:

```bash
npm run test:file src/app/features/tasks/task-timeline/task-timeline.component.spec.ts
```

Expected: PASS for all `TaskTimelineComponent` tests.

- [ ] **Step 12: Run file checks**

Run:

```bash
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.util.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.util.spec.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.component.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.component.scss
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.component.spec.ts
```

Expected: each command exits 0.

- [ ] **Step 13: Commit Task 3**

Run:

```bash
git add src/app/features/tasks/task-timeline
git commit -m "feat(tasks): add timeline editor"
```

---

## Task 4: Integrate Timeline Into Task Detail Panel

**Files:**
- Modify: `src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts`
- Modify: `src/app/features/tasks/task-detail-panel/task-detail-panel.component.html`
- Test: `src/app/features/tasks/task-timeline/task-timeline.component.spec.ts`

- [ ] **Step 1: Write failing integration expectations in the component spec**

Append this test to `src/app/features/tasks/task-timeline/task-timeline.component.spec.ts`:

```ts
  it('emits a timeline with a new stage when empty', () => {
    fixture.componentRef.setInput('timeline', undefined);
    fixture.detectChanges();
    spyOn(component.timelineChange, 'emit');

    component.addStage();

    expect(component.timelineChange.emit).toHaveBeenCalled();
    const emitted = (component.timelineChange.emit as jasmine.Spy).calls.mostRecent()
      .args[0] as TaskTimeline;
    expect(emitted.stages).toHaveSize(1);
    expect(emitted.stages[0].nodes).toEqual([]);
  });
```

- [ ] **Step 2: Run the component spec to verify the current behavior**

Run:

```bash
npm run test:file src/app/features/tasks/task-timeline/task-timeline.component.spec.ts
```

Expected: PASS if Task 3 already covered empty adds correctly. This is an integration guard before wiring into the detail panel.

- [ ] **Step 3: Import the timeline component into the task detail panel**

Modify `src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts`:

```ts
import { TaskTimelineComponent } from '../task-timeline/task-timeline.component';
import { TaskTimeline } from '../task-timeline/task-timeline.model';
```

Add `TaskTimelineComponent` to the `imports` array:

```ts
    TaskTimelineComponent,
```

Add this method near the other task update handlers:

```ts
  updateTimeline(timeline: TaskTimeline): void {
    this.taskService.update(this.task().id, { timeline });
  }
```

- [ ] **Step 4: Render the timeline panel in the detail panel**

Modify `src/app/features/tasks/task-detail-panel/task-detail-panel.component.html` after the subtasks/parent block and before the time estimate block:

```html
  @if (!task().parentId) {
    <task-detail-item
      (collapseParent)="collapseParent()"
      (keyPress)="onItemKeyPress($event)"
      [expanded]="!!task().timeline?.stages?.length && !isDialogMode()"
      [type]="'panel'"
    >
      <ng-container panel-header>
        <mat-icon>timeline</mat-icon>
        <span>{{ T.F.TASK.ADDITIONAL_INFO.TIMELINE | translate }}</span>
      </ng-container>
      <ng-container panel-content>
        <task-timeline
          [timeline]="task().timeline"
          (timelineChange)="updateTimeline($event)"
        ></task-timeline>
      </ng-container>
    </task-detail-item>
  }
```

- [ ] **Step 5: Run task detail file checks**

Run:

```bash
npm run checkFile src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts
npm run checkFile src/app/features/tasks/task-detail-panel/task-detail-panel.component.html
```

Expected: each command exits 0.

- [ ] **Step 6: Run targeted specs**

Run:

```bash
npm run test:file src/app/features/tasks/task-timeline/task-timeline.component.spec.ts
npm run test:file src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts src/app/features/tasks/task-detail-panel/task-detail-panel.component.html src/app/features/tasks/task-timeline/task-timeline.component.spec.ts
git commit -m "feat(tasks): show timeline in task details"
```

---

## Task 5: User Documentation And Final Verification

**Files:**
- Modify: `docs/wiki/4.09-Task-Attributes.md`

- [ ] **Step 1: Update the task attributes wiki**

In `docs/wiki/4.09-Task-Attributes.md`, add a section near subtasks and notes:

```md
## Timeline

A task can have an internal timeline for long-horizon work. Timelines are separate from subtasks: they do not create task entities, do not change the task estimate, and do not appear in project or tag task lists.

Timeline stages run in order. A stage may contain multiple parallel nodes, and the next stage unlocks after every node in the current stage is completed. Each node records when it was started and completed.
```

- [ ] **Step 2: Run markdown status check**

Run:

```bash
git diff -- docs/wiki/4.09-Task-Attributes.md
```

Expected: diff shows only the new Timeline section.

- [ ] **Step 3: Run all required file checks**

Run:

```bash
npm run checkFile src/app/features/tasks/task.model.ts
npm run checkFile src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.model.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.util.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.util.spec.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.component.ts
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.component.scss
npm run checkFile src/app/features/tasks/task-timeline/task-timeline.component.spec.ts
npm run checkFile src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts
npm run checkFile src/app/features/tasks/task-detail-panel/task-detail-panel.component.html
npm run checkFile src/app/t.const.ts
```

Expected: each command exits 0.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm run test:file src/app/features/tasks/task-timeline/task-timeline.util.spec.ts
npm run test:file src/app/features/tasks/task-timeline/task-timeline.component.spec.ts
npm run test:file src/app/root-store/meta/task-shared-meta-reducers/task-shared-crud.reducer.spec.ts
```

Expected: each command exits 0.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git diff --stat
git diff -- src/app/features/tasks/task-timeline src/app/features/tasks/task.model.ts src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts src/app/features/tasks/task-detail-panel/task-detail-panel.component.html src/app/t.const.ts src/assets/i18n/en.json docs/wiki/4.09-Task-Attributes.md
```

Expected: diff contains only timeline model, helper, component, task detail integration, translations, tests, and wiki documentation.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add docs/wiki/4.09-Task-Attributes.md
git commit -m "docs(tasks): document task timelines"
```

---

## Final Acceptance Checklist

- [ ] Timeline data is stored on the parent task as `timeline`.
- [ ] Timeline nodes are not subtasks and do not create task entities.
- [ ] Stages are ordered.
- [ ] Nodes inside an unlocked stage can be started in parallel.
- [ ] A later stage stays locked until all nodes in the previous stage complete.
- [ ] Node `startedAt` and `completedAt` timestamps persist via task updates.
- [ ] UI is available in the task detail panel for top-level tasks.
- [ ] Existing subtask behavior remains unchanged.
- [ ] English i18n strings exist.
- [ ] Wiki documentation explains timeline behavior separately from subtasks.
- [ ] Required `npm run checkFile` commands pass for every modified `.ts` and `.scss` file.
- [ ] Targeted tests pass.
