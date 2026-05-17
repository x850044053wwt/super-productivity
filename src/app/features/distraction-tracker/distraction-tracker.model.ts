export enum DistractionCategory {
  Phone = 'Phone',
  SocialMedia = 'SocialMedia',
  External = 'External',
  Wandering = 'Wandering',
  Other = 'Other',
}

export interface DistractionEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly category: DistractionCategory;
  readonly note?: string;
  readonly taskId?: string;
  readonly focusSessionStartedAt?: number;
}

export interface DistractionTrackerState {
  readonly entries: ReadonlyArray<DistractionEntry>;
}
