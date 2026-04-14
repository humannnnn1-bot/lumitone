import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { ja } from "../i18n/ja";

describe("theory copy", () => {
  it("restricts De Morgan claims to disjoint colors", () => {
    expect(en.theory_dice_footer_demorgan).toMatch(/disjoint colors/i);
    expect(en.theory_dice_footer_demorgan).toContain("a ∧ b = 0");
    expect(en.theory_conn_boolean_hook).toContain("a ∧ b = 0");

    expect(ja.theory_dice_footer_demorgan).toContain("a ∧ b = 0");
    expect(ja.theory_conn_boolean_hook).toContain("a ∧ b = 0");
    expect(ja.theory_conn_boolean_hook).toContain("重なりのない2色");
  });

  it("describes Hamming as a position-error demo", () => {
    expect(en.theory_hamming_desc.toLowerCase()).toContain("position");
    expect(en.theory_hamming_flip.toLowerCase()).toContain("position");
    expect(en.theory_hamming_desc.toLowerCase()).not.toContain("single channel flips");

    expect(ja.theory_hamming_desc).toContain("位置");
    expect(ja.theory_hamming_flip).toContain("位置");
    expect(ja.theory_hamming_desc).not.toContain("チャンネル");
  });

  it("clarifies that the [8,4,4] note is about coordinates, not codewords", () => {
    expect(en.theory_conn_extended.toLowerCase()).toContain("coordinate");
    expect(en.theory_conn_extended.toLowerCase()).toContain("not codewords");

    expect(ja.theory_conn_extended).toContain("座標");
    expect(ja.theory_conn_extended).toContain("位置ラベル");
  });
});
