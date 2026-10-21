process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import JSZip from "jszip";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import DeckVersion from "@/app/models/DeckVersion";
import { executeDeckPatch, saveDeckSnapshot } from "../[id]/route";
import { buildPptx } from "@/lib/export/pptx";
import type { SlideData } from "@/lib/slides-schema";
import { calculateFittedFontSize, PPTX_WIDTH_POINTS, PPTX_HEIGHT_POINTS, estimateWrappedLines } from "@/lib/layout-constants";

describe("J3, J4, J5: Deck Patch Concurrency, Pinned Versions & PPTX Export", () => {
  let mongoServer: MongoMemoryServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // ── J3: Ownership, Field Capping, Single Slide Patch & Stale Write Rejection ───

  it("J3.1: rejects non-owner with 404 Not Found", async () => {
    const owner = await User.create({ name: "Owner", email: "owner@test.com", credits: 5 });
    const intruder = await User.create({ name: "Intruder", email: "intruder@test.com", credits: 5 });

    const deck = await Deck.create({
      userId: owner._id,
      title: "Private Deck",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Slide 1", notes: "", content: {} }],
    });

    const res = await executeDeckPatch({
      deckId: deck._id.toString(),
      userId: intruder._id.toString(),
      patchData: { title: "Hacked Title" },
    });

    assert.equal(res.status, 404);
    assert.equal(res.data.error, "Not found.");

    // Verify deck untouched
    const check = await Deck.findById(deck._id);
    assert.equal(check?.title, "Private Deck");
  });

  it("J3.2: updates only the changed slide (single-slide patch) and caps field lengths", async () => {
    const user = await User.create({ name: "Editor", email: "editor@test.com", credits: 5 });

    const deck = await Deck.create({
      userId: user._id,
      title: "Three Slide Deck",
      status: "ready",
      version: 1,
      slides: [
        { id: "s0", layout: "title", title: "Original S0", notes: "N0", content: {} },
        { id: "s1", layout: "bullets", title: "Original S1", notes: "N1", content: { bullets: ["Old B1", "Old B2"] } },
        { id: "s2", layout: "closing", title: "Original S2", notes: "N2", content: {} },
      ],
    });

    // Create a 250-character title and 600-character bullet to test capping
    const overlyLongTitle = "A".repeat(250);
    const overlyLongBullet = "B".repeat(600);
    const overlyLongNotes = "N".repeat(2500);

    const res = await executeDeckPatch({
      deckId: deck._id.toString(),
      userId: user._id.toString(),
      patchData: {
        slideIndex: 1,
        slide: {
          id: "s1",
          layout: "bullets",
          title: overlyLongTitle,
          notes: overlyLongNotes,
          content: {
            bullets: [overlyLongBullet, "Normal bullet"],
          },
        },
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.version, 2);

    const refreshed = await Deck.findById(deck._id);
    assert.ok(refreshed);

    // Slide 0 and Slide 2 must remain completely intact
    assert.equal(refreshed.slides[0].title, "Original S0");
    assert.equal(refreshed.slides[2].title, "Original S2");

    // Slide 1 was updated and fields capped
    const s1 = refreshed.slides[1];
    assert.equal(s1.title.length, 200, "Title should be capped at 200 characters");
    assert.equal(s1.notes.length, 2000, "Notes should be capped at 2000 characters");
    assert.equal(s1.content.bullets[0].length, 500, "Bullet should be capped at 500 characters");
    assert.equal(s1.content.bullets[1], "Normal bullet");
  });

  it("J3.3: rejects stale writes via expectedUpdatedAt and version with 409 Conflict", async () => {
    const user = await User.create({ name: "Concurrency User", email: "concurrency@test.com", credits: 5 });

    const deck = await Deck.create({
      userId: user._id,
      title: "Concurrent Deck",
      status: "ready",
      version: 5,
      slides: [{ id: "s1", layout: "title", title: "Title v5", notes: "", content: {} }],
    });

    // 1. Mismatched version
    const versionMismatchRes = await executeDeckPatch({
      deckId: deck._id.toString(),
      userId: user._id.toString(),
      patchData: {
        title: "Stale Version Title",
        version: 3, // older version than 5
      },
    });

    assert.equal(versionMismatchRes.status, 409);
    assert.equal(versionMismatchRes.data.conflict, true);
    assert.match(versionMismatchRes.data.error, /Version mismatch/);

    // 2. Outdated expectedUpdatedAt (e.g. 5 minutes before deck's current updatedAt)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const staleTimeRes = await executeDeckPatch({
      deckId: deck._id.toString(),
      userId: user._id.toString(),
      patchData: {
        title: "Stale Time Title",
        expectedUpdatedAt: fiveMinutesAgo,
      },
    });

    assert.equal(staleTimeRes.status, 409);
    assert.equal(staleTimeRes.data.conflict, true);
    assert.match(staleTimeRes.data.error, /Deck has been modified elsewhere/);

    // 3. Valid expectedUpdatedAt and version succeeds and bumps version
    const validRes = await executeDeckPatch({
      deckId: deck._id.toString(),
      userId: user._id.toString(),
      patchData: {
        title: "Fresh Title v6",
        version: 5,
        expectedUpdatedAt: deck.updatedAt.toISOString(),
      },
    });

    assert.equal(validRes.status, 200);
    assert.equal(validRes.data.version, 6);
  });

  // ── J4: Pin Initial Generated Version in DeckVersion ──────────────────────────

  it("J4: pins the first generated version in DeckVersion so it is never rotated out", async () => {
    const user = await User.create({ name: "Pin User", email: "pin@test.com", credits: 5 });

    const deck = await Deck.create({
      userId: user._id,
      title: "Versioned Deck",
      theme: "modern",
      status: "ready",
      slides: [
        { id: "s1", layout: "title", title: "First Generated Title", notes: "", content: {} },
      ],
    });

    // 1. Save initial snapshot
    await saveDeckSnapshot(deck);

    const initialVersion = await DeckVersion.findOne({ deckId: deck._id });
    assert.ok(initialVersion, "Initial version must exist");
    assert.equal(initialVersion.pinned, true, "First generated version must be pinned");
    assert.equal(initialVersion.isInitial, true, "First generated version must be marked isInitial");
    assert.equal(initialVersion.slides[0].title, "First Generated Title");

    // 2. Perform 15 consecutive snapshots/edits (capping unpinned at 10)
    for (let i = 1; i <= 15; i++) {
      deck.slides[0].title = `Edit iteration ${i}`;
      await saveDeckSnapshot(deck);
    }

    // 3. Query all versions for this deck
    const allVersions = await DeckVersion.find({ deckId: deck._id }).sort({ createdAt: 1 });

    // Capped at 10 unpinned + 1 pinned initial version = 11 total
    assert.equal(allVersions.length, 11, "Should retain 1 pinned initial + 10 recent unpinned versions");

    // Verify the initial pinned version is STILL present and never rotated out
    const stillPinned = await DeckVersion.findOne({ deckId: deck._id, pinned: true });
    assert.ok(stillPinned, "Pinned initial version must never be rotated out");
    assert.equal(stillPinned.slides[0].title, "First Generated Title");
    assert.equal(stillPinned.isInitial, true);
  });

  // ── J5: Export PPTX with Edited Title & Long Bullet Without Overflow ───────────

  it("J5: exported PPTX contains edited title and prevents long edited bullet from overflowing", async () => {
    const user = await User.create({ name: "Export User", email: "export@test.com", credits: 5 });

    // Edited title & a long 400-character bullet
    const editedTitle = "Transforming Enterprise AI Workflows in 2026";
    const longEditedBullet =
      "By integrating real-time neural semantic grounding with automated document chunking, organizations can reliably synthesize multi-thousand-page technical specifications into high-impact boardroom presentations without hallucinating numerical figures or exceeding structural slide bounding boxes.";

    const deck = await Deck.create({
      userId: user._id,
      title: editedTitle,
      theme: "modern",
      status: "ready",
      slides: [
        {
          id: "slide-1",
          layout: "bullets",
          title: editedTitle,
          notes: "Speaker notes for slide 1.",
          content: {
            bullets: [
              longEditedBullet,
              "Second concise bullet point with standard length metrics.",
            ],
          },
        },
      ],
    });

    // 1. Verify font fitting calculation guarantees no overflow
    const bulletsText = [longEditedBullet, "Second concise bullet point with standard length metrics."].join("\n");
    const containerW = PPTX_WIDTH_POINTS * 0.9; // 864 pt
    const containerH = PPTX_HEIGHT_POINTS * 0.7; // 378 pt
    const fittedFontSize = calculateFittedFontSize(
      bulletsText,
      containerW,
      containerH,
      24,
      12,
      "Arial"
    );

    const estimatedLines = estimateWrappedLines(bulletsText, containerW, fittedFontSize, "Arial");
    const requiredHeight = estimatedLines * fittedFontSize * 1.3;

    assert.ok(
      requiredHeight <= containerH,
      `Required height (${requiredHeight}pt) must not exceed container height (${containerH}pt)`
    );
    assert.ok(fittedFontSize >= 12, `Fitted font size (${fittedFontSize}) must be >= minFontSize (12)`);

    // 2. Generate actual PPTX buffer
    const pptxBuffer = await buildPptx(deck.title, deck.slides as any, deck.theme, false);
    assert.ok(pptxBuffer && pptxBuffer.length > 0, "PPTX export buffer must be generated");

    // 3. Unzip PPTX and verify slide XML contains the edited title and bullet text
    const zip = await JSZip.loadAsync(pptxBuffer);
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("text");
    assert.ok(slideXml, "Slide 1 XML must exist in PPTX archive");

    assert.ok(
      slideXml.includes("Transforming Enterprise AI Workflows in 2026"),
      "Edited title must appear in exported PPTX slide XML"
    );
    assert.ok(
      slideXml.includes("neural semantic grounding"),
      "Long edited bullet content must appear in exported PPTX slide XML"
    );
  });

  it("enforces max 60 slides on executeDeckPatch and rejects with 400", async () => {
    const user = await User.create({ name: "Cap User", email: "cap@test.com", credits: 5 });
    const deck = await Deck.create({
      userId: user._id,
      title: "Capped Deck",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Intro", notes: "", content: {} }],
    });

    const tooManySlides = Array.from({ length: 61 }, (_, i) => ({
      id: `slide-id-${i}`,
      layout: "bullets",
      title: `Slide ${i}`,
      notes: "",
      content: { bullets: ["Point"] },
    }));

    const res = await executeDeckPatch({
      deckId: deck._id.toString(),
      userId: user._id.toString(),
      patchData: {
        slides: tooManySlides,
      },
    });

    assert.equal(res.status, 400);
    assert.ok(
      JSON.stringify(res.data).includes("60 slides") || JSON.stringify(res.data).includes("Validation failed"),
      "Must reject with 400 when exceeding 60 slides"
    );
  });

  it("rejects duplicate slide IDs with 400 Bad Request", async () => {
    const user = await User.create({ name: "Dup User", email: "dup@test.com", credits: 5 });
    const deck = await Deck.create({
      userId: user._id,
      title: "Duplicate Test Deck",
      status: "ready",
      slides: [
        { id: "slide-1", layout: "title", title: "Slide 1", notes: "", content: {} },
        { id: "slide-2", layout: "bullets", title: "Slide 2", notes: "", content: {} },
      ],
    });

    // Test duplicate IDs in full slides patch
    const resFull = await executeDeckPatch({
      deckId: deck._id.toString(),
      userId: user._id.toString(),
      patchData: {
        slides: [
          { id: "same-id", layout: "title", title: "S1", notes: "", content: {} },
          { id: "same-id", layout: "bullets", title: "S2", notes: "", content: {} },
        ],
      },
    });

    assert.equal(resFull.status, 400);
    assert.ok(
      resFull.data.error?.includes("Duplicate slide id detected") || JSON.stringify(resFull.data).includes("Duplicate"),
      "Must reject duplicate slide IDs"
    );

    // Test duplicate ID in single slide patch
    const resSingle = await executeDeckPatch({
      deckId: deck._id.toString(),
      userId: user._id.toString(),
      patchData: {
        slideIndex: 0,
        slide: { id: "slide-2", layout: "title", title: "S1 with S2 id", notes: "", content: {} },
      },
    });

    assert.equal(resSingle.status, 400);
    assert.ok(
      resSingle.data.error?.includes("Duplicate slide id detected"),
      "Must reject single slide patch duplicate ID"
    );
  });

  it("confirms exported PPTX contains no _stash data", async () => {
    const STASH_CANARY = "SECRET_CANARY_DATA_DO_NOT_LEAK_INTO_PPTX_ARCHIVE";
    const slideWithStash: SlideData = {
      id: "slide-stash-test",
      layout: "bullets",
      title: "Legitimate Slide Title",
      notes: "Legitimate Speaker Notes",
      content: {
        bullets: ["Legitimate Public Bullet Point"],
        _stash: {
          title: { subtitle: STASH_CANARY },
          quote: { quote: `${STASH_CANARY}_QUOTE` },
        },
      },
    } as SlideData;

    const pptxBuffer = await buildPptx("Export Stash Test", [slideWithStash], "modern", false);
    const zip = await JSZip.loadAsync(pptxBuffer);

    const fileNames = Object.keys(zip.files);
    for (const fileName of fileNames) {
      const file = zip.files[fileName];
      if (!file.dir) {
        const text = await file.async("text");
        assert.ok(
          !text.includes(STASH_CANARY),
          `Exported file ${fileName} must not contain _stash data`
        );
      }
    }
  });
});

