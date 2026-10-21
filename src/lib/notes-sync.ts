/**
 * Pure functions for speaker notes synchronization and target resolution.
 * Prevents race conditions during autosave and active slide navigation.
 */

export interface SlideWithNotes {
  id: string;
  notes?: string;
  [key: string]: any;
}

export interface ApplyNotesUpdateResult<T> {
  updatedSlides: T[];
  updated: boolean;
  targetIndex: number;
}

/**
 * Pure function to safely apply a notes update to a specific target slide by ID.
 * Guarantees that notes are only written to the slide matching targetSlideId,
 * preventing race conditions when activeSlideIdx changes during a debounced save.
 * If targetSlideId is not found, returns the slides array unchanged.
 */
export function applyNotesUpdate<T extends SlideWithNotes>(
  slides: T[],
  targetSlideId: string,
  newNotes: string
): ApplyNotesUpdateResult<T> {
  if (!Array.isArray(slides) || !targetSlideId) {
    return { updatedSlides: slides || [], updated: false, targetIndex: -1 };
  }

  const targetIndex = slides.findIndex((s) => s.id === targetSlideId);
  if (targetIndex === -1) {
    return { updatedSlides: slides, updated: false, targetIndex: -1 };
  }

  const updatedSlides = slides.map((s, idx) => {
    if (idx === targetIndex) {
      return { ...s, notes: newNotes };
    }
    return s;
  });

  return { updatedSlides, updated: true, targetIndex };
}

export interface ShouldSyncNotesParams {
  currentSlideId: string | undefined;
  lastSyncedSlideId: string | undefined;
  isTextareaFocused: boolean;
}

/**
 * Determines whether the notes editor textarea should sync its internal state from props.
 * Rules:
 * - Always sync if navigating to a different slide (currentSlideId !== lastSyncedSlideId).
 * - Sync if the textarea is NOT currently focused by the user.
 * - Never overwrite text the user is actively typing (focused on the same slide).
 */
export function shouldSyncNotesFromProps(params: ShouldSyncNotesParams): boolean {
  if (!params.currentSlideId) return false;

  // Slide changed -> must sync to the new slide's notes
  if (params.currentSlideId !== params.lastSyncedSlideId) {
    return true;
  }

  // Same slide: only sync if the user is not actively focused/typing
  return !params.isTextareaFocused;
}
