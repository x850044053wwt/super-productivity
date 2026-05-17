import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { DistractionTrackerService } from '../distraction-tracker.service';
import { DistractionCategory } from '../distraction-tracker.model';
import {
  DISTRACTION_CATEGORY_META,
  DISTRACTION_CATEGORY_ORDER,
} from '../distraction-tracker.const';

export interface DistractionLogDialogData {
  readonly focusSessionStartedAt?: number;
  readonly taskId?: string;
}

@Component({
  selector: 'distraction-log-dialog',
  templateUrl: './distraction-log-dialog.component.html',
  styleUrls: ['./distraction-log-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatInput,
    MatTooltip,
    FormsModule,
    TranslatePipe,
  ],
})
export class DistractionLogDialogComponent {
  private readonly _dialogRef = inject(MatDialogRef<DistractionLogDialogComponent>);
  private readonly _service = inject(DistractionTrackerService);
  private readonly _data: DistractionLogDialogData =
    inject(MAT_DIALOG_DATA, {
      optional: true,
    }) ?? {};

  readonly T = T;
  readonly categories = DISTRACTION_CATEGORY_ORDER;
  readonly categoryMeta = DISTRACTION_CATEGORY_META;

  readonly note = signal('');
  readonly selected = signal<DistractionCategory | null>(null);

  selectCategory(category: DistractionCategory): void {
    this.selected.set(category);
  }

  logCategory(category: DistractionCategory): void {
    this.selected.set(category);
    this._commit(category);
  }

  saveSelected(): void {
    const c = this.selected();
    if (c) this._commit(c);
  }

  cancel(): void {
    this._dialogRef.close();
  }

  private _commit(category: DistractionCategory): void {
    const noteValue = this.note().trim();
    this._service.log(category, {
      note: noteValue || undefined,
      taskId: this._data.taskId,
      focusSessionStartedAt: this._data.focusSessionStartedAt,
    });
    this._dialogRef.close();
  }
}
