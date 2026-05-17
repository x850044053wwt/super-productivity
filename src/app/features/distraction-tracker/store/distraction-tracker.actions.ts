import { createAction, props } from '@ngrx/store';
import { DistractionEntry } from '../distraction-tracker.model';

export const loadDistractions = createAction(
  '[DistractionTracker] Load Distractions',
  props<{ entries: ReadonlyArray<DistractionEntry> }>(),
);

export const addDistraction = createAction(
  '[DistractionTracker] Add Distraction',
  props<{ entry: DistractionEntry }>(),
);

export const deleteDistraction = createAction(
  '[DistractionTracker] Delete Distraction',
  props<{ id: string }>(),
);

export const clearAllDistractions = createAction(
  '[DistractionTracker] Clear All Distractions',
);
