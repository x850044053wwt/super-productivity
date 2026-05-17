import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { DistractionTrackerService } from '../distraction-tracker.service';
import {
  DistractionLogDialogComponent,
  DistractionLogDialogData,
} from '../distraction-log-dialog/distraction-log-dialog.component';

@Component({
  selector: 'distraction-log-button',
  templateUrl: './distraction-log-button.component.html',
  styleUrls: ['./distraction-log-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatIcon, MatTooltip, TranslatePipe],
})
export class DistractionLogButtonComponent {
  private readonly _matDialog = inject(MatDialog);
  protected readonly service = inject(DistractionTrackerService);

  /** Start of the active focus session (epoch ms). When set, the button shows
   *  the count of distractions logged since this timestamp. */
  readonly sessionStartedAt = input<number | undefined>();
  readonly taskId = input<string | undefined>();

  readonly T = T;

  readonly displayCount = computed(() => {
    const since = this.sessionStartedAt();
    return since !== undefined
      ? this.service.countSince(since)
      : this.service.todayCount();
  });

  open(): void {
    const data: DistractionLogDialogData = {
      focusSessionStartedAt: this.sessionStartedAt(),
      taskId: this.taskId(),
    };
    this._matDialog.open(DistractionLogDialogComponent, {
      data,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }
}
