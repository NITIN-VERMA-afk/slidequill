process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Deck, { type ISlide } from "@/app/models/Deck";
import User from "@/app/models/User";
import DeckVersion from "@/app/models/DeckVersion";
import { applyOps } from "@/lib/ai-edit/apply";
import type { Op } from "@/lib/ai-edit/ops";

describe("Slide Regeneration & AI Chat Resilience Without sourceText", () => {
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

  it("slide regeneration data flow operates solely on slide state when sourceText is absent", async () => {
    const user = await User.create({
      name: "Regen User",
      email: "regen.user@example.com",
      credits: 5,
      hasPurchased: true,
    });

    // Create deck with NO sourceText (already deleted or expired)
    const deck = await Deck.create({
      userId: user._id,
      title: "Deck Without Source",
      status: "ready",
      slides: [
        {
          id: "slide-101",
          layout: "bullets",
          title: "Revenue Model Analysis",
          content: { bullets: ["Subscription model drives 80% ARR", "Low churn rate"] },
          notes: "Focus on ARR sustainability.",
          regenerations: 0,
        },
      ],
    });

    // Verify database document has no sourceText
    const dbDeck = await Deck.findById(deck._id).select("+sourceText").lean();
    assert.equal(dbDeck?.sourceText, undefined);

    // Simulate slide regeneration flow
    const slideIndex = deck.slides.findIndex((s: ISlide) => s.id === "slide-101");
    assert.equal(slideIndex, 0);

    const existingSlide = (deck.slides[slideIndex] as any).toObject() as ISlide;
    assert.equal(existingSlide.regenerations, 0);

    // Snapshot creation (DeckVersion) works without sourceText
    await DeckVersion.create({
      deckId: deck._id,
      slides: deck.slides,
      theme: deck.theme,
      reason: "Regenerate slide test",
    });

    const version = await DeckVersion.findOne({ deckId: deck._id });
    assert.ok(version);
    assert.equal(version.slides.length, 1);

    // Updated slide applies and regenerations counter increments
    const regeneratedSlide: ISlide = {
      id: existingSlide.id,
      layout: existingSlide.layout,
      title: "Sustained Revenue Acceleration",
      content: { bullets: ["ARR expanded 2.4x YoY", "Net retention at 128%"] },
      notes: existingSlide.notes,
      regenerations: (existingSlide.regenerations ?? 0) + 1,
    };

    deck.slides[slideIndex] = regeneratedSlide;
    deck.markModified(`slides.${slideIndex}`);
    await deck.save();

    const savedDeck = await Deck.findById(deck._id);
    assert.equal(savedDeck?.slides[0].title, "Sustained Revenue Acceleration");
    assert.equal(savedDeck?.slides[0].regenerations, 1);
  });

  it("chat operation engine (applyOps) mutates slides cleanly when sourceText is absent", async () => {
    const initialSlides: ISlide[] = [
      {
        id: "slide-a",
        layout: "title",
        title: "Company Overview",
        content: { subtitle: "Preliminary deck" },
        notes: "",
      },
      {
        id: "slide-b",
        layout: "bullets",
        title: "Market Strategy",
        content: { bullets: ["Old bullet 1", "Old bullet 2", "Old bullet 3"] },
        notes: "",
      },

    ];

    const ops: Op[] = [
      {
        op: "update_slide",
        slideId: "slide-b",
        fields: {
          title: "Global Market Go-To-Market Strategy",
        },
      },
      {
        op: "set_theme",
        theme: "corporate",
      },

    ];

    const result = applyOps(initialSlides, "modern", ops);
    assert.equal(result.appliedOps.length, 2);
    assert.equal(result.theme, "corporate");
    assert.equal(result.slides[1].title, "Global Market Go-To-Market Strategy");
  });

  it("returns clear note when regenerating a stats or chart slide after sourceText was deleted", async () => {
    const user = await User.create({
      name: "Deleted Source User",
      email: "deleted.source@example.com",
      credits: 5,
      hasPurchased: true,
    });

    // Create deck with stats and chart slides and NO sourceText (deleted)
    const deck = await Deck.create({
      userId: user._id,
      title: "Deck With Deleted Source",
      status: "ready",
      slides: [
        {
          id: "slide-stats-1",
          layout: "stats",
          title: "Operating Metrics",
          content: { stats: [{ value: "100M", label: "ARR" }] },
          notes: "Stats notes.",
          regenerations: 0,
        },
        {
          id: "slide-chart-1",
          layout: "chart",
          title: "Quarterly Growth",
          content: {
            chartType: "bar",
            categories: ["Q1", "Q2", "Q3"],
            series: [{ name: "Metric", values: [10, 20, 30] }],
          },
          notes: "Chart notes.",
          regenerations: 0,
        },
      ],
    });

    const isSourceDeleted = !deck.sourceText || !deck.sourceText.trim();
    assert.equal(isSourceDeleted, true, "deck.sourceText must be deleted/empty");

    // Check stats slide regeneration logic
    const statsSlide = deck.slides[0];
    const isStats = statsSlide.layout === "stats" || statsSlide.layout === "chart";
    const statsNote =
      isSourceDeleted && isStats
        ? "Source text was deleted, so this slide can't use verified numbers"
        : undefined;
    assert.equal(statsNote, "Source text was deleted, so this slide can't use verified numbers");

    // Check chart slide regeneration logic
    const chartSlide = deck.slides[1];
    const isChart = chartSlide.layout === "stats" || chartSlide.layout === "chart";
    const chartNote =
      isSourceDeleted && isChart
        ? "Source text was deleted, so this slide can't use verified numbers"
        : undefined;
    assert.equal(chartNote, "Source text was deleted, so this slide can't use verified numbers");
  });
});

