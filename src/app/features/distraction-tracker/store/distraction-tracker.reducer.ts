import {
  Action,
  createFeatureSelector,
  createReducer,
  createSelector,
  on,
} from '@ngrx/store';
import { DistractionEntry, DistractionTrackerState } from '../distraction-tracker.model';
import { DISTRACTION_TRACKER_MAX_ENTRIES } from '../distraction-tracker.const';
import {
  addDistraction,
  clearAllDistractions,
  deleteDistraction,
  loadDistractions,
} from './distraction-tracker.actions';

export const DISTRACTION_TRACKER_FEATURE_KEY = 'distractionTracker';

export const initialDistractionTrackerState: DistractionTrackerState = {
  entries: [],
};

const _reducer = createReducer<DistractionTrackerState>(
  initialDistractionTrackerState,

  on(loadDistractions, (_state, { entries }) => ({
    entries: [...entries],
  })),

  on(addDistraction, (state, { entry }) => {
    const next = [entry, ...state.entries];
    return {
      entries:
        next.length > DISTRACTION_TRACKER_MAX_ENTRIES
          ? next.slice(0, DISTRACTION_TRACKER_MAX_ENTRIES)
          : next,
    };
  }),

  on(deleteDistraction, (state, { id }) => ({
    entries: state.entries.filter((e) => e.id !== id),
  })),

  on(clearAllDistractions, () => initialDistractionTrackerState),
);

export const distractionTrackerReducer = (
  state: DistractionTrackerState = initialDistractionTrackerState,
  action: Action,
): DistractionTrackerState => _reducer(state, action);

export const selectDistractionTrackerFeatureState =
  createFeatureSelector<DistractionTrackerState>(DISTRACTION_TRACKER_FEATURE_KEY);

export const selectAllDistractions = createSelector(
  selectDistractionTrackerFeatureState,
  (s): ReadonlyArray<DistractionEntry> => s.entries,
);
