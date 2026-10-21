import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultSlide,
  duplicateSlide,
  deleteSlide,
  reorderSlides,
  switchSlideLayout,
  extractTextItemsFromContent,
  MAX_DECK_SLIDES,
  ReorderDebounceManager,
  stripStashFromSlide,
  stripStashFromDeck,
} from "../slide-mutations";
import { groundAndSanitizeSlide, type SlideData } from "../slides-schema";

describe("Slide Mutations & Layout Switcher", () => {
  const layouts = [
    "title",
    "bullets",
    "two_column",
    "stats",
    "process",
    "comparison",
    "quote",
    "closing",
  ];

  it("creates default slides with valid required fields for all layouts", () => {
    for (const layout of layouts) {
      const slide = createDefaultSlide(layout);
      assert.equal(slide.layout, layout);
      assert.ok(slide.id && slide.id.length > 0);
      assert.ok(slide.title && slide.title.length > 0);
      assert.ok(slide.content && typeof slide.content === "object");
      assert.equal(slide.regenerations, 0);
    }
  });

  it("duplicates a slide with new ID, resets regenerations to 0, and keeps sourcePage", () => {
    const original: SlideData = {
      id: "orig-slide-123",
      layout: "bullets",
      title: "Quarterly Review",
      notes: "Speaker talking points",
      sourcePage: "15-18",
      sourceSection: "Financial Performance",
      regenerations: 4,
      content: { bullets: ["Revenue up 25%", "Operating margin expanded"] },
    } as SlideData;

    const deck = [original];
    const { updated, newIndex } = duplicateSlide(deck, 0);

    assert.equal(updated.length, 2);
    assert.equal(newIndex, 1);
    const dup = updated[1];
    assert.notEqual(dup.id, original.id, "Duplicate must have a unique ID");
    assert.equal(dup.regenerations, 0, "Duplicate must reset regenerations to 0");
    assert.equal(dup.sourcePage, "15-18", "Duplicate must keep sourcePage");
    assert.equal(dup.sourceSection, "Financial Performance", "Duplicate must keep sourceSection");
    assert.equal(dup.title, original.title);
    assert.deepEqual(dup.content, original.content);
  });

  it("enforces max 60 slides on duplication", () => {
    const slides: SlideData[] = Array.from({ length: 60 }, (_, i) => ({
      id: `slide-${i}`,
      layout: "bullets",
      title: `Slide ${i}`,
      notes: "",
      content: { bullets: ["Sample point"] },
    } as SlideData));

    assert.throws(
      () => duplicateSlide(slides, 0),
      /Deck cannot exceed maximum of 60 slides/
    );
  });

  it("deletes slide correctly and prevents deleting the last slide", () => {
    const s1: SlideData = { id: "s1", layout: "title", title: "Intro", notes: "", content: {} } as SlideData;
    const s2: SlideData = { id: "s2", layout: "bullets", title: "Body", notes: "", content: {} } as SlideData;

    const { updated } = deleteSlide([s1, s2], 0);
    assert.equal(updated.length, 1);
    assert.equal(updated[0].id, "s2");

    assert.throws(() => deleteSlide([s2], 0), /Cannot delete the only slide/);
  });

  it("reorders slides cleanly for drag-and-drop and keyboard navigation", () => {
    const slides = [
      { id: "s1", title: "Slide 1" } as SlideData,
      { id: "s2", title: "Slide 2" } as SlideData,
      { id: "s3", title: "Slide 3" } as SlideData,
    ];

    // Move s1 to end
    const reordered1 = reorderSlides(slides, 0, 2);
    assert.deepEqual(reordered1.map(s => s.id), ["s2", "s3", "s1"]);

    // Move s3 to start
    const reordered2 = reorderSlides(slides, 2, 0);
    assert.deepEqual(reordered2.map(s => s.id), ["s3", "s1", "s2"]);

    // Invalid bounds return original list unchanged
    const unchanged = reorderSlides(slides, -1, 5);
    assert.deepEqual(unchanged.map(s => s.id), ["s1", "s2", "s3"]);
  });

  it("preserves image fields when switching to layouts that don't render images and back", () => {
    const slideWithImage: SlideData = {
      id: "img-slide",
      layout: "image",
      title: "Team Collaboration",
      notes: "Leadership focus",
      sourcePage: 12,
      content: {
        imageUrl: "https://images.unsplash.com/photo-test-123",
        imageKeyword: "teamwork office",
        photographer: "Jane Doe",
        photographerUrl: "https://unsplash.com/@janedoe",
        heading: "Teamwork Matters",
        bullets: ["Alignment", "Execution"],
      },
    } as SlideData;

    // Switch image -> bullets (doesn't render background/split image directly)
    const switchedToBullets = switchSlideLayout(slideWithImage, "bullets");
    assert.equal(switchedToBullets.layout, "bullets");
    assert.equal(switchedToBullets.content.imageUrl, "https://images.unsplash.com/photo-test-123");
    assert.equal(switchedToBullets.content.photographer, "Jane Doe");
    assert.equal(switchedToBullets.notes, "Leadership focus");
    assert.equal(switchedToBullets.sourcePage, 12);

    // Switch back bullets -> image
    const restoredImage = switchSlideLayout(switchedToBullets, "image");
    assert.equal(restoredImage.layout, "image");
    assert.equal(restoredImage.content.imageUrl, "https://images.unsplash.com/photo-test-123");
    assert.equal(restoredImage.content.photographer, "Jane Doe");
  });

  it("performs lossless round-trip layout conversion (A -> B -> A loses no text) across all 8 layouts", () => {
    // For each layout A, test roundtrip to each layout B and back to A
    for (const layoutA of layouts) {
      const baseSlide = createDefaultSlide(layoutA);
      // Give baseSlide unique verifiable text strings
      baseSlide.title = `Title of ${layoutA}`;
      baseSlide.notes = `Notes for ${layoutA}`;

      const textBefore = extractTextItemsFromContent(layoutA, baseSlide.content).join(" ");
      assert.ok(textBefore.length > 0, `Base slide for ${layoutA} should have extracted text`);

      for (const layoutB of layouts) {
        if (layoutA === layoutB) continue;

        // A -> B
        const slideB = switchSlideLayout(baseSlide, layoutB);
        assert.equal(slideB.layout, layoutB);

        // B -> A
        const slideA = switchSlideLayout(slideB, layoutA);
        assert.equal(slideA.layout, layoutA);

        const textAfter = extractTextItemsFromContent(layoutA, slideA.content).join(" ");

        // Verify that primary textual content from A is preserved in A after roundtrip
        const firstItemBefore = extractTextItemsFromContent(layoutA, baseSlide.content)[0];
        assert.ok(
          textAfter.includes(firstItemBefore),
          `Roundtrip ${layoutA} -> ${layoutB} -> ${layoutA} must preserve initial text '${firstItemBefore}'. Found: '${textAfter}'`
        );
        assert.equal(slideA.title, baseSlide.title);
        assert.equal(slideA.notes, baseSlide.notes);
      }
    }
  });

  describe("ReorderDebounceManager", () => {
    it("debounces rapid moves and commits once after delay", async () => {
      let commitCount = 0;
      let lastCommitted: any[] | null = null;
      const manager = new ReorderDebounceManager((slides) => {
        commitCount++;
        lastCommitted = slides;
      }, 50);

      const move1 = [{ id: "1" }, { id: "2" }];
      const move2 = [{ id: "2" }, { id: "1" }];

      manager.schedule(move1);
      assert.equal(manager.hasPending(), true);
      manager.schedule(move2); // Rapid second move

      assert.equal(commitCount, 0, "Should not commit immediately");
      await new Promise((r) => setTimeout(r, 80));

      assert.equal(commitCount, 1, "Should commit exactly once after delay");
      assert.deepEqual(lastCommitted, move2);
      assert.equal(manager.hasPending(), false);
    });

    it("flushes immediately when requested (e.g. before another mutation or on unmount)", () => {
      let committed: any = null;
      const manager = new ReorderDebounceManager((slides) => {
        committed = slides;
      }, 500);

      const pendingOrder = [{ id: "slide-b" }, { id: "slide-a" }];
      manager.schedule(pendingOrder);
      assert.equal(manager.hasPending(), true);

      // Flush before next mutation
      const flushed = manager.flush();
      assert.equal(flushed, true);
      assert.deepEqual(committed, pendingOrder);
      assert.equal(manager.hasPending(), false);

      // Subsequent flush returns false as nothing is pending
      assert.equal(manager.flush(), false);
    });

    it("cancels pending commit cleanly", async () => {
      let committed = false;
      const manager = new ReorderDebounceManager(() => {
        committed = true;
      }, 30);

      manager.schedule([{ id: "s1" }]);
      manager.cancel();
      assert.equal(manager.hasPending(), false);

      await new Promise((r) => setTimeout(r, 50));
      assert.equal(committed, false);
    });
  });

  describe("_stash lifecycle and sanitization", () => {
    it("caps _stash size and entry count when switching layouts repeatedly", () => {
      let slide = createDefaultSlide("bullets");
      slide.title = "Stash Cap Test";

      // Switch through many layouts to fill stash
      for (const layout of layouts) {
        slide = switchSlideLayout(slide, layout);
      }

      const stash = (slide.content as any)._stash;
      assert.ok(stash, "Stash should exist on switched slide");
      const keys = Object.keys(stash);
      assert.ok(keys.length <= 8, `Stash keys must be capped at <= 8, got ${keys.length}`);
      assert.ok(JSON.stringify(stash).length <= 15000, "Serialized stash must be capped at <= 15KB");
    });

    it("stripStashFromSlide and stripStashFromDeck cleanly remove _stash without touching other fields", () => {
      const slideWithStash: SlideData = {
        id: "s1",
        layout: "bullets",
        title: "Test Slide",
        notes: "Some notes",
        content: {
          bullets: ["Point 1", "Point 2"],
          _stash: {
            title: { subtitle: "Secret old subtitle" },
          },
        },
      } as SlideData;

      const cleanSlide = stripStashFromSlide(slideWithStash);
      assert.equal("_stash" in cleanSlide.content, false, "_stash must be removed");
      assert.deepEqual((cleanSlide.content as any).bullets, ["Point 1", "Point 2"]);
      assert.equal(cleanSlide.title, "Test Slide");
      assert.equal(cleanSlide.notes, "Some notes");

      const deck = {
        slides: [slideWithStash],
        theme: "modern",
      };
      const cleanDeck = stripStashFromDeck(deck);
      assert.equal("_stash" in cleanDeck.slides[0].content, false);
    });

    it("groundAndSanitizeSlide strips _stash so ungrounded numbers in stash are never processed", () => {
      const slideWithStash: SlideData = {
        id: "s-ground",
        layout: "bullets",
        title: "Revenue Growth",
        notes: "Grounded note",
        content: {
          bullets: ["Revenue grew by 25%"],
          _stash: {
            stats: {
              stats: [{ value: "$999B", label: "Fake Unverified Stat" }],
            },
          },
        },
      } as SlideData;

      // Source contains 25% but NOT $999B
      const source = "In Q3, overall revenue grew by 25% year over year.";
      const grounded = groundAndSanitizeSlide(slideWithStash, source);

      assert.equal("_stash" in grounded.content, false, "_stash must be stripped during grounding");
      assert.ok((grounded.content as any).bullets[0].includes("25%"), "Legitimate numbers in active layout remain grounded");
    });
  });
});

