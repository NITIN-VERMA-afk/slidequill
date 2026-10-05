import { z } from "zod";

// Text constraints to prevent overflowing slides
const textRule = (maxWords: number) => 
  z.string().refine(s => s.split(" ").length <= maxWords, { message: `Max ${maxWords} words` });

export const SlideLayouts = z.discriminatedUnion("layout", [
  z.object({
    layout: z.literal("title"),
    content: z.object({
      subtitle: textRule(15).optional(),
    }),
  }),
  z.object({
    layout: z.literal("bullets"),
    content: z.object({
      bullets: z.array(textRule(12)).min(3).max(6),
    }),
  }),
  z.object({
    layout: z.literal("two_column"),
    content: z.object({
      left: z.object({
        heading: textRule(6).optional(),
        bullets: z.array(textRule(12)).min(2).max(4),
      }),
      right: z.object({
        heading: textRule(6).optional(),
        bullets: z.array(textRule(12)).min(2).max(4),
      }),
    }),
  }),
  z.object({
    layout: z.literal("stats"),
    content: z.object({
      stats: z.array(
        z.object({
          value: textRule(4),
          label: textRule(8),
        })
      ).min(2).max(4),
    }),
  }),
  z.object({
    layout: z.literal("process"),
    content: z.object({
      steps: z.array(
        z.object({
          label: textRule(5),
          desc: textRule(10),
        })
      ).min(3).max(5),
    }),
  }),
  z.object({
    layout: z.literal("comparison"),
    content: z.object({
      columns: z.array(
        z.object({
          heading: textRule(5),
          bullets: z.array(textRule(10)).min(2).max(4),
        })
      ).min(2).max(3),
    }),
  }),
  z.object({
    layout: z.literal("quote"),
    content: z.object({
      quote: textRule(30),
      attribution: textRule(8).optional(),
    }),
  }),
  z.object({
    layout: z.literal("closing"),
    content: z.object({
      headline: textRule(8),
      cta: textRule(10).optional(),
    }),
  }),
]);

export const SlideSchema = z.object({
  title: textRule(8).describe("State the conclusion, not just a topic. E.g. 'Sales Grew 40%' instead of 'Sales Data'."),
  notes: z.string().describe("Short speaker notes for this slide (1-2 sentences)."),
}).and(SlideLayouts);

export type SlideData = z.infer<typeof SlideSchema> & { id: string };
