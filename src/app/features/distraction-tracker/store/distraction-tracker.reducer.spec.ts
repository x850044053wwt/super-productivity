import {
  distractionTrackerReducer,
  initialDistractionTrackerState,
} from './distraction-tracker.reducer';
import {
  addDistraction,
  clearAllDistractions,
  deleteDistraction,
  loadDistractions,
} from './distraction-tracker.actions';
import { DistractionCategory, DistractionEntry } from '../distraction-tracker.model';
import { DISTRACTION_TRACKER_MAX_ENTRIES } from '../distraction-tracker.const';

const mkEntry = (overrides: Partial<DistractionEntry> = {}): DistractionEntry => ({
  id: overrides.id ?? 'e1',
  timestamp: overrides.timestamp ?? 1_700_000_000_000,
  category: overrides.category ?? DistractionCategory.Phone,
  ...(overrides.note !== undefined ? { note: overrides.note } : {}),
  ...(overrides.taskId !== undefined ? { taskId: overrides.taskId } : {}),
});

describe('distractionTrackerReducer', () => {
  it('returns initial state by default', () => {
    expect(distractionTrackerReducer(undefined, { type: '@@INIT' } as never)).toEqual(
      initialDistractionTrackerState,
    );
  });

  it('loadDistractions replaces entries', () => {
    const start = {
      ...initialDistractionTrackerState,
      entries: [mkEntry({ id: 'old' })],
    };
    const next = distractionTrackerReducer(
      start,
      loadDistractions({ entries: [mkEntry({ id: 'a' }), mkEntry({ id: 'b' })] }),
    );
    expect(next.entries.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('addDistraction prepends entry (newest-first)', () => {
    const start = {
      ...initialDistractionTrackerState,
      entries: [mkEntry({ id: 'older' })],
    };
    const next = distractionTrackerReducer(
      start,
      addDistraction({ entry: mkEntry({ id: 'newer' }) }),
    );
    expect(next.entries.map((e) => e.id)).toEqual(['newer', 'older']);
  });

  it('addDistraction enforces max entries cap', () => {
    const existing = Array.from({ length: DISTRACTION_TRACKER_MAX_ENTRIES }, (_, i) =>
      mkEntry({ id: `e${i}` }),
    );
    const start = { ...initialDistractionTrackerState, entries: existing };
    const next = distractionTrackerReducer(
      start,
      addDistraction({ entry: mkEntry({ id: 'newest' }) }),
    );
    expect(next.entries.length).toBe(DISTRACTION_TRACKER_MAX_ENTRIES);
    expect(next.entries[0].id).toBe('newest');
    // Last entry (oldest) was dropped
    expect(
      next.entries.find((e) => e.id === `e${DISTRACTION_TRACKER_MAX_ENTRIES - 1}`),
    ).toBeUndefined();
  });

  it('deleteDistraction removes the matching entry', () => {
    const start = {
      ...initialDistractionTrackerState,
      entries: [mkEntry({ id: 'a' }), mkEntry({ id: 'b' }), mkEntry({ id: 'c' })],
    };
    const next = distractionTrackerReducer(start, deleteDistraction({ id: 'b' }));
    expect(next.entries.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('clearAllDistractions resets to initial state', () => {
    const start = {
      ...initialDistractionTrackerState,
      entries: [mkEntry({ id: 'a' })],
    };
    expect(distractionTrackerReducer(start, clearAllDistractions())).toEqual(
      initialDistractionTrackerState,
    );
  });
});
