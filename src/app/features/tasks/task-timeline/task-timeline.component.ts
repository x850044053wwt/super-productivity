import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
  standalone: true,
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
    this.timelineChange.emit(addStage(this.timeline(), '', nanoid()));
  }

  addNode(stageId: string): void {
    const currentTimeline = this.timeline();

    if (!currentTimeline) {
      return;
    }

    this.emitIfChanged(
      addNodeToStage(currentTimeline, stageId, '', nanoid()),
      currentTimeline,
    );
  }

  updateStageTitle(stageId: string, title: string): void {
    const currentTimeline = this.timeline();

    if (!currentTimeline) {
      return;
    }

    this.emitIfChanged(
      updateStageTitle(currentTimeline, stageId, title),
      currentTimeline,
    );
  }

  updateNodeTitle(nodeId: string, title: string): void {
    const currentTimeline = this.timeline();

    if (!currentTimeline) {
      return;
    }

    this.emitIfChanged(updateNodeTitle(currentTimeline, nodeId, title), currentTimeline);
  }

  deleteStage(stageId: string): void {
    const currentTimeline = this.timeline();

    if (!currentTimeline) {
      return;
    }

    this.emitIfChanged(deleteStage(currentTimeline, stageId), currentTimeline);
  }

  deleteNode(nodeId: string): void {
    const currentTimeline = this.timeline();

    if (!currentTimeline) {
      return;
    }

    this.emitIfChanged(deleteNode(currentTimeline, nodeId), currentTimeline);
  }

  start(nodeId: string): void {
    const currentTimeline = this.timeline();

    if (!currentTimeline) {
      return;
    }

    const updated = startNode(currentTimeline, nodeId, Date.now());

    this.emitIfChanged(updated, currentTimeline);
  }

  complete(nodeId: string): void {
    const currentTimeline = this.timeline();

    if (!currentTimeline) {
      return;
    }

    const updated = completeNode(currentTimeline, nodeId, Date.now());

    this.emitIfChanged(updated, currentTimeline);
  }

  reopen(nodeId: string): void {
    const currentTimeline = this.timeline();

    if (!currentTimeline) {
      return;
    }

    const updated = reopenNode(currentTimeline, nodeId);

    this.emitIfChanged(updated, currentTimeline);
  }

  inputValue(event: Event): string {
    const target = event.target;

    return target instanceof HTMLInputElement ? target.value : '';
  }

  private emitIfChanged(updated: TaskTimeline, currentTimeline: TaskTimeline): void {
    if (updated !== currentTimeline) {
      this.timelineChange.emit(updated);
    }
  }
}
