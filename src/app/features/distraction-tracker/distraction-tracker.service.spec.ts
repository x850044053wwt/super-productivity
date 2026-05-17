import { TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { DistractionTrackerService } from './distraction-tracker.service';
import {
  DistractionCategory,
  DistractionEntry,
  DistractionTrackerState,
} from './distraction-tracker.model';
import {
  DISTRACTION_TRACKER_FEATURE_KEY,
  selectAllDistractions,
} from './store/distraction-tracker.reducer';
import { DISTRACTION_TRACKER_LS_KEY } from './distraction-tracker.const';
import {
  addDistraction,
  clearAllDistractions,
  deleteDistraction,
} from './store/distraction-tracker.actions';

describe('DistractionTrackerService', () => {
  let service: DistractionTrackerService;
  let store: MockStore<{
    [DISTRACTION_TRACKER_FEATURE_KEY]: DistractionTrackerState;
  }>;

  const setup = (initialEntries: ReadonlyArray<DistractionEntry> = []): void => {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          initialState: {
            [DISTRACTION_TRACKER_FEATURE_KEY]: { entries: initialEntries },
          },
        }),
      ],
    });
    store = TestBed.inject(MockStore);
    store.overrideSelector(selectAllDistractions, initialEntries);
    service = TestBed.inject(DistractionTrackerService);
  };

  beforeEach(() => {
    localStorage.removeItem(DISTRACTION_TRACKER_LS_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(DISTRACTION_TRACKER_LS_KEY);
  });

  it('ignores malformed localStorage payloads without throwing', () => {
    localStorage.setItem(DISTRACTION_TRACKER_LS_KEY, '{not json');
    expect(() => setup()).not.toThrow();
  });

  it('log() dispatches addDistraction with a generated id and current timestamp', () => {
    setup();
    const before = Date.now();
    const dispatchSpy = spyOn(store, 'dispatch');
    service.log(DistractionCategory.Phone, { note: 'twitch', taskId: 't1' });
    const after = Date.now();
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const call = dispatchSpy.calls.mostRecent().args[0] as ReturnType<
      typeof addDistraction
    >;
    expect(call.type).toBe(addDistraction.type);
    expect(call.entry.category).toBe(DistractionCategory.Phone);
    expect(call.entry.note).toBe('twitch');
    expect(call.entry.taskId).toBe('t1');
    expect(call.entry.id).toBeTruthy();
    expect(call.entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(call.entry.timestamp).toBeLessThanOrEqual(after);
  });

  it('log() omits note/taskId when not provided', () => {
    setup();
    const dispatchSpy = spyOn(store, 'dispatch');
    service.log(DistractionCategory.Wandering);
    const call = dispatchSpy.calls.mostRecent().args[0] as ReturnType<
      typeof addDistraction
    >;
    expect(call.entry.note).toBeUndefined();
    expect(call.entry.taskId).toBeUndefined();
  });

  it('delete() and clearAll() dispatch the right actions', () => {
    setup();
    const dispatchSpy = spyOn(store, 'dispatch');
    service.delete('abc');
    expect(dispatchSpy).toHaveBeenCalledWith(deleteDistraction({ id: 'abc' }));
    service.clearAll();
    expect(dispatchSpy).toHaveBeenCalledWith(clearAllDistractions());
  });

  it('countSince() counts only entries newer than the cutoff', () => {
    const now = Date.now();
    const entries: DistractionEntry[] = [
      { id: '1', timestamp: now - 1000, category: DistractionCategory.Phone },
      { id: '2', timestamp: now - 5000, category: DistractionCategory.Wandering },
      { id: '3', timestamp: now - 60_000, category: DistractionCategory.Other },
    ];
    setup(entries);
    expect(service.countSince(now - 6000)).toBe(2);
    expect(service.countSince(now - 100)).toBe(0);
    expect(service.countSince(0)).toBe(3);
  });

  it('entriesForDay() filters by local calendar day', () => {
    const HOUR_MS = 3_600_000;
    const dayStart = new Date(2026, 4, 17, 0, 0, 0, 0).getTime();
    const at = (hoursFromDayStart: number): number => {
      const offset = hoursFromDayStart * HOUR_MS;
      return dayStart + offset;
    };
    const entries: DistractionEntry[] = [
      { id: 'today-am', timestamp: at(9), category: DistractionCategory.Phone },
      { id: 'today-pm', timestamp: at(22), category: DistractionCategory.External },
      { id: 'yesterday', timestamp: at(-1), category: DistractionCategory.Other },
      { id: 'tomorrow', timestamp: at(30), category: DistractionCategory.Other },
    ];
    setup(entries);
    const result = service.entriesForDay(at(12));
    expect(result.map((e) => e.id).sort()).toEqual(['today-am', 'today-pm']);
  });
});
