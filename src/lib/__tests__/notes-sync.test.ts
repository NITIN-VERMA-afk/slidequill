import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyNotesUpdate,
  shouldSyncNotesFromProps,
  type SlideWithNotes,
} from "../notes-sync";

describe("Notes Editor Race Fixes & Target Resolution (src/lib/notes-sync.ts)", () => {
  const initialSlides: SlideWithNotes[] = [
    { id: "slide-1", title: "Slide One", notes: "Original notes 1" },
    { id: "slide-2", title: "Slide Two", notes: "Original notes 2" },
    { id: "slide-3", title: "Slide Three", notes: "Original notes 3" },
  ];

  it("applies notes update exclusively to the target slide matching targetSlideId", () => {
    const result = applyNotesUpdate(initialSlides, "slide-2", "Updated notes for slide 2");

    assert.equal(result.updated, true);
    assert.equal(result.targetIndex, 1);
    assert.equal(result.updatedSlides[1].notes, "Updated notes for slide 2");
    // Ensure slide 1 and slide 3 are completely untouched
    assert.equal(result.updatedSlides[0].notes, "Original notes 1");
    assert.equal(result.updatedSlides[2].notes, "Original notes 3");
  });

  it("never writes notes to a different slide when user switched active slides", () => {
    // User was on slide-1, typing "Notes for slide 1", then activeSlideIdx shifted to index 2 (slide-3)
    const result = applyNotesUpdate(initialSlides, "slide-1", "Notes intended for slide 1");

    assert.equal(result.updated, true);
    assert.equal(result.targetIndex, 0);
    // Target was slide-1: slide-3 must NOT receive slide-1's notes
    assert.equal(result.updatedSlides[0].notes, "Notes intended for slide 1");
    assert.equal(result.updatedSlides[2].notes, "Original notes 3");
  });

  it("safely handles non-existent or deleted slide IDs without modifying any slides", () => {
    const result = applyNotesUpdate(initialSlides, "deleted-slide", "Orphaned notes");

    assert.equal(result.updated, false);
    assert.equal(result.targetIndex, -1);
    assert.deepEqual(result.updatedSlides, initialSlides);
  });

  it("shouldSyncNotesFromProps syncs when navigating to a different slide id", () => {
    const shouldSync = shouldSyncNotesFromProps({
      currentSlideId: "slide-2",
      lastSyncedSlideId: "slide-1",
      isTextareaFocused: true, // even if focused, slide navigation must sync
    });
    assert.equal(shouldSync, true);
  });

  it("shouldSyncNotesFromProps syncs on same slide when textarea is not focused", () => {
    const shouldSync = shouldSyncNotesFromProps({
      currentSlideId: "slide-1",
      lastSyncedSlideId: "slide-1",
      isTextareaFocused: false, // not focused: external prop update or initial load
    });
    assert.equal(shouldSync, true);
  });

  it("shouldSyncNotesFromProps NEVER overwrites text while the user is focused and typing on the same slide", () => {
    const shouldSync = shouldSyncNotesFromProps({
      currentSlideId: "slide-1",
      lastSyncedSlideId: "slide-1",
      isTextareaFocused: true, // user is actively typing!
    });
    assert.equal(shouldSync, false, "Must never overwrite while user is focused/typing");
  });
});
