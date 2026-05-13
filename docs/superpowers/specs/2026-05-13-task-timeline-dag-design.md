# Task Timeline DAG Design

## Summary

Add a timeline to a single task so long-horizon work can be broken into a gated sequence without using subtasks. The timeline is a stage-based DAG: stages run in order, while nodes inside the same stage may run in parallel. A later stage unlocks only after every node in the previous stage is complete.

This solves the "I finished A and forgot B/C" problem while keeping the main task as the only trackable task entity.

## Goals

- Let a task contain an internal work timeline independent of subtasks.
- Support a main sequence such as A -> B -> C.
- Allow a stage such as B to contain multiple parallel nodes.
- Record when each node starts and completes.
- Sync timeline data across devices through existing task persistence.
- Avoid node-level duration estimates, time tracking, scheduling, or separate task entities.

## Non-Goals

- Do not convert timeline nodes into subtasks.
- Do not include per-node time estimates.
- Do not include node-level due dates, reminders, tags, attachments, or issue links.
- Do not make a freeform graph drawing tool in the first version.
- Do not affect task `timeSpent`, `timeEstimate`, or parent/subtask rollups.

## Data Model

Add an optional `timeline` field to `TaskCopy`.

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
```

The stage array order is the graph order. Every node in stage `n + 1` depends on all nodes in stage `n`. This is a constrained DAG that matches the requested workflow while keeping editing simple inside the task detail panel.

`timeline` is optional so legacy tasks remain valid and no migration is required for existing data. Missing or empty timeline data renders as an empty timeline panel.

## State And Sync

Timeline edits update the parent task through `TaskSharedActions.updateTask` with a `timeline` field change. This uses the existing persistent `TASK` update path and therefore syncs with the op-log like other task fields.

Reducers must keep updates immutable. Timeline helper functions should accept the current `TaskTimeline | undefined` and return a new `TaskTimeline` object. They should not mutate stages or nodes in place.

Because timeline nodes are not task entities, existing subtask archive, parent rollup, project membership, tag membership, and sync-repair logic should not need timeline-specific relationship validation.

## UI

Add a separate **Timeline** panel to `TaskDetailPanelComponent`, near the existing subtasks panel but independent from it.

Panel behavior:

- Show stages in order.
- Show nodes inside each stage as parallel items.
- Provide controls to add a stage, add a node, edit titles, delete nodes, delete empty stages, and reorder stages/nodes.
- Show each node state: not started, in progress, complete, or locked.
- Show `startedAt` and `completedAt` timestamps when present.
- Allow multiple nodes in the same unlocked stage to be in progress at once.
- Lock a stage until all nodes in the previous stage are complete.
- Treat the first non-complete stage as the only unlocked stage.

Starting a node sets `startedAt` if it is not already set. Completing a node sets `completedAt`; if `startedAt` is absent, completing also sets `startedAt` to the same timestamp. Reopening a completed node clears `completedAt` but keeps `startedAt`.

The first implementation should use a compact stage list editor, not a freeform canvas. It still represents a DAG, but is easier to scan and operate in the right-side task panel.

## Error Handling And Validation

Timeline helper functions should normalize invalid-but-recoverable input at the component/service boundary:

- Missing `timeline` means an empty timeline.
- Missing `stages` means no stages.
- Stages without nodes are allowed while editing.
- Nodes with `completedAt` but no `startedAt` are displayed as completed; the next write should preserve or repair by setting `startedAt` to `completedAt`.
- A stage is considered complete only when it has at least one node and every node has `completedAt`.

The UI should not allow starting locked nodes. If remote sync makes the current stage locked after a local view is stale, the action helper should no-op rather than corrupting the timeline.

## Testing

Unit tests should cover pure timeline helpers first:

- Empty timeline creates the first stage and node.
- Starting a node records `startedAt`.
- Completing a node records `completedAt`.
- Completing without a start records both timestamps.
- Multiple nodes in one stage can be in progress together.
- A later stage is locked until every previous-stage node is complete.
- Reopening a completed node clears only `completedAt`.
- Reordering stages or nodes preserves node timestamps.

Component tests should cover:

- Timeline panel renders independently from subtasks.
- Locked nodes cannot be started through the UI.
- The next stage unlocks after all nodes in the current stage complete.
- Task updates dispatch with the new `timeline` value.

Run `npm run checkFile` on every modified `.ts` and `.scss` file during implementation, plus targeted specs for timeline helpers and task detail UI.

## Documentation

Because this is user-facing functionality, update the wiki alongside implementation. The likely target is `docs/wiki/4.09-Task-Attributes.md`, with a short mention that task timelines are internal staged progress plans and are separate from subtasks.

## Implementation Shape

Recommended files:

- `src/app/features/tasks/task.model.ts`: add timeline types and optional `timeline` field.
- `src/app/features/tasks/task-timeline/`: add a small standalone timeline panel/component and pure helper utilities.
- `src/app/features/tasks/task-detail-panel/task-detail-panel.component.*`: render the timeline panel and pass task updates through `TaskService.update`.
- `src/assets/i18n/en.json` and `src/app/t.const.ts`: add Timeline strings.
- `docs/wiki/4.09-Task-Attributes.md`: document the user-facing attribute.

The first version should favor reliable core interactions over graph polish. A freeform graph view can be added later if the stage-list model proves too restrictive.
