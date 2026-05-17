import { computed, inject, Injectable, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { Log } from '../../core/log';
import { uuidv7 } from '../../util/uuid-v7';
import { DistractionCategory, DistractionEntry } from './distraction-tracker.model';
import { DISTRACTION_TRACKER_LS_KEY } from './distraction-tracker.const';
import {
  addDistraction,
  clearAllDistractions,
  deleteDistraction,
  loadDistractions,
} from './store/distraction-tracker.actions';
import { selectAllDistractions } from './store/distraction-tracker.reducer';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class DistractionTrackerService {
  private readonly _store = inject(Store);

  // Reactive view of all entries (newest-first)
  readonly entries = toSignal(this._store.select(selectAllDistractions), {
    initialValue: [] as ReadonlyArray<DistractionEntry>,
  });

  // Today's count, recomputed when entries change or "now" rolls past midnight.
  // We tick `_dayKey` only when a logging action happens, which is the only
  // realistic time the count needs to be re-evaluated against a new day boundary.
  private readonly _dayKey = signal(this._computeDayKey(Date.now()));

  readonly todayCount = computed(() => {
    const dayStart = this._dayKey();
    const dayEnd = dayStart + MS_PER_DAY;
    return this.entries().filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd)
      .length;
  });

  constructor() {
    this._hydrateFromLocalStorage();
  }

  /** Returns the count of entries logged since `sinceTimestamp` (ms). */
  countSince(sinceTimestamp: number): number {
    return this.entries().filter((e) => e.timestamp >= sinceTimestamp).length;
  }

  /** Returns entries for the calendar day containing `timestamp` (ms). */
  entriesForDay(timestamp: number): ReadonlyArray<DistractionEntry> {
    const dayStart = this._computeDayKey(timestamp);
    const dayEnd = dayStart + MS_PER_DAY;
    return this.entries().filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd);
  }

  log(
    category: DistractionCategory,
    options: {
      note?: string;
      taskId?: string;
      focusSessionStartedAt?: number;
    } = {},
  ): void {
    const entry: DistractionEntry = {
      id: uuidv7(),
      timestamp: Date.now(),
      category,
      ...(options.note ? { note: options.note } : {}),
      ...(options.taskId ? { taskId: options.taskId } : {}),
      ...(options.focusSessionStartedAt
        ? { focusSessionStartedAt: options.focusSessionStartedAt }
        : {}),
    };
    this._store.dispatch(addDistraction({ entry }));
    this._dayKey.set(this._computeDayKey(entry.timestamp));
    this._persist();
  }

  delete(id: string): void {
    this._store.dispatch(deleteDistraction({ id }));
    this._persist();
  }

  clearAll(): void {
    this._store.dispatch(clearAllDistractions());
    this._persist();
  }

  private _hydrateFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(DISTRACTION_TRACKER_LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { entries?: DistractionEntry[] };
      const entries = Array.isArray(parsed?.entries)
        ? parsed.entries.filter(this._isValidEntry)
        : [];
      if (entries.length) {
        this._store.dispatch(loadDistractions({ entries }));
      }
    } catch (err) {
      Log.err('DistractionTracker: failed to hydrate from localStorage', { err });
    }
  }

  private _persist(): void {
    // Defer to next microtask so the dispatched action has been applied to state.
    queueMicrotask(() => {
      try {
        const payload = { entries: this.entries() };
        localStorage.setItem(DISTRACTION_TRACKER_LS_KEY, JSON.stringify(payload));
      } catch (err) {
        Log.err('DistractionTracker: failed to persist to localStorage', { err });
      }
    });
  }

  private _isValidEntry = (e: unknown): e is DistractionEntry => {
    if (!e || typeof e !== 'object') return false;
    const r = e as Record<string, unknown>;
    return (
      typeof r.id === 'string' &&
      typeof r.timestamp === 'number' &&
      typeof r.category === 'string'
    );
  };

  private _computeDayKey(timestamp: number): number {
    const d = new Date(timestamp);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
}
