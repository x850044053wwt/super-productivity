import { DistractionCategory } from './distraction-tracker.model';

export const DISTRACTION_TRACKER_LS_KEY = 'SP_DISTRACTION_TRACKER';

export const DISTRACTION_TRACKER_MAX_ENTRIES = 1000;

export interface DistractionCategoryMeta {
  readonly icon: string;
  readonly labelKey: string;
}

export const DISTRACTION_CATEGORY_META: Record<
  DistractionCategory,
  DistractionCategoryMeta
> = {
  [DistractionCategory.Phone]: {
    icon: 'smartphone',
    labelKey: 'F.DISTRACTION_TRACKER.CATEGORY.PHONE',
  },
  [DistractionCategory.SocialMedia]: {
    icon: 'public',
    labelKey: 'F.DISTRACTION_TRACKER.CATEGORY.SOCIAL_MEDIA',
  },
  [DistractionCategory.External]: {
    icon: 'people',
    labelKey: 'F.DISTRACTION_TRACKER.CATEGORY.EXTERNAL',
  },
  [DistractionCategory.Wandering]: {
    icon: 'cloud',
    labelKey: 'F.DISTRACTION_TRACKER.CATEGORY.WANDERING',
  },
  [DistractionCategory.Other]: {
    icon: 'more_horiz',
    labelKey: 'F.DISTRACTION_TRACKER.CATEGORY.OTHER',
  },
};

export const DISTRACTION_CATEGORY_ORDER: ReadonlyArray<DistractionCategory> = [
  DistractionCategory.Phone,
  DistractionCategory.SocialMedia,
  DistractionCategory.External,
  DistractionCategory.Wandering,
  DistractionCategory.Other,
];
