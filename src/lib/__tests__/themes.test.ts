import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { themes, defaultThemeId, getTheme, type ThemeDef } from "../themes";

describe("Themes single-source-of-truth (ThemeDef)", () => {
  it("defines the 6 required standard themes", () => {
    const expectedKeys = ["modern", "corporate", "creative", "dark", "playful", "elegant"];
    assert.deepEqual(Object.keys(themes), expectedKeys);
  });

  it("every theme has all required ThemeDef fields including description", () => {
    for (const [id, theme] of Object.entries(themes)) {
      assert.equal(theme.id, id, `Theme key ${id} must match theme.id`);
      assert.ok(theme.name && theme.name.trim().length > 0, `Theme ${id} must have a name`);
      assert.ok(
        typeof theme.description === "string" && theme.description.trim().length > 10,
        `Theme ${id} must have a descriptive description string`
      );
      assert.ok(theme.colors.bg && theme.colors.bg.startsWith("#"), `Theme ${id} must have hex bg`);
      assert.ok(theme.colors.surface && theme.colors.surface.startsWith("#"), `Theme ${id} must have hex surface`);
      assert.ok(theme.colors.text && theme.colors.text.startsWith("#"), `Theme ${id} must have hex text`);
      assert.ok(theme.colors.mutedText && theme.colors.mutedText.startsWith("#"), `Theme ${id} must have hex mutedText`);
      assert.ok(theme.colors.accent && theme.colors.accent.startsWith("#"), `Theme ${id} must have hex accent`);
      assert.ok(theme.colors.accent2 && theme.colors.accent2.startsWith("#"), `Theme ${id} must have hex accent2`);
      assert.ok(theme.headingFont?.name, `Theme ${id} must have headingFont`);
      assert.ok(theme.bodyFont?.name, `Theme ${id} must have bodyFont`);
      assert.ok(
        ["center", "left", "split"].includes(theme.titleSlideStyle),
        `Theme ${id} has valid titleSlideStyle`
      );
      assert.ok(
        typeof theme.cornerRadius === "number" && theme.cornerRadius >= 0,
        `Theme ${id} has non-negative numeric cornerRadius`
      );
    }
  });

  it("getTheme returns matching theme or falls back to defaultThemeId", () => {
    assert.equal(defaultThemeId, "modern");
    assert.equal(getTheme("corporate").id, "corporate");
    assert.equal(getTheme("corporate").description, themes.corporate.description);
    assert.equal(getTheme("unknown_theme_123").id, defaultThemeId);
  });
});
