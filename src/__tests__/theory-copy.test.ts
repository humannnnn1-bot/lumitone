import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { ja } from "../i18n/ja";

describe("theory copy", () => {
  it("restricts De Morgan claims to disjoint colors", () => {
    expect(en.theory_dice_footer_demorgan).toMatch(/disjoint colors/i);
    expect(en.theory_dice_footer_demorgan).toContain("a ∧ b = 0");
    expect(en.theory_conn_boolean_hook).toContain("a ∧ b = 0");
    expect(en.theory_dice_footer_subtractive).toContain("a ∨ b = 7");
    expect(en.theory_dice_footer_subtractive).toContain("a + b - 7 = a ∧ b");

    expect(ja.theory_dice_footer_demorgan).toContain("a ∧ b = 0");
    expect(ja.theory_conn_boolean_hook).toContain("a ∧ b = 0");
    expect(ja.theory_conn_boolean_hook).toContain("重なりのない2色");
    expect(ja.theory_dice_footer_subtractive).toContain("a ∨ b = 7");
    expect(ja.theory_dice_footer_subtractive).toContain("a + b - 7 = a ∧ b");
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

  it("describes the cube-Fano link as subspaces rather than seven literal plane slices", () => {
    expect(en.theory_conn_cube_geometry_hook.toLowerCase()).toContain("two-dimensional subspaces");
    expect(en.theory_conn_cube_geometry_hook.toLowerCase()).toContain("even-parity tetrahedron");
    expect(en.theory_conn_cube_geometry_hook.toLowerCase()).not.toContain("7 fano lines are planar cross-sections");

    expect(ja.theory_conn_cube_geometry_hook).toContain("2 次元部分空間");
    expect(ja.theory_conn_cube_geometry_hook).toContain("偶数パリティ四面体");
  });

  it("avoids claiming that octahedron gradients literally show the XOR color at the midpoint", () => {
    expect(en.theory_octa_desc.toLowerCase()).not.toContain("visible as the edge gradient’s midpoint");
    expect(en.theory_octa_desc.toLowerCase()).not.toContain("literal rgb midpoint");

    expect(ja.theory_octa_desc).not.toContain("中点色として描いているわけではありません");
    expect(ja.theory_octa_desc).not.toContain("中間点として視認できます");
  });

  it("explains subtractive examples as Boolean AND identities instead of carry-corrected XOR", () => {
    expect(en.theory_xor_desc).toContain("a + b = (a ⊕ b) + 2(a ∧ b)");
    expect(en.theory_xor_desc.toLowerCase()).toContain("boolean-and identities");
    expect(en.theory_xor_desc.toLowerCase()).not.toContain("carry correction");

    expect(ja.theory_xor_desc).toContain("a + b = (a ⊕ b) + 2(a ∧ b)");
    expect(ja.theory_xor_desc).toContain("ブール AND の恒等式");
    expect(ja.theory_xor_desc).not.toContain("桁あふれ補正");
  });

  it("states the hue-order uniqueness claim in terms of free nets and the face-adjacency path", () => {
    expect(en.theory_dice_desc3).toContain("11 free cube nets");
    expect(en.theory_dice_desc3).toContain("face-adjacency tree");
    expect(en.theory_dice_desc3).toContain("R→Y→G→C→B→M");
    expect(en.theory_dice_desc3).toContain("equivalently its reverse");
    expect(en.theory_dice_desc3).not.toContain("Among the 11 cube nets");

    expect(ja.theory_dice_desc3).toContain("11種類の立方体展開図（回転・反転は同一視）");
    expect(ja.theory_dice_desc3).toContain("面隣接木（各面を頂点、辺共有を枝とする木）");
    expect(ja.theory_dice_desc3).toContain("面隣接木全体");
    expect(ja.theory_dice_desc3).toContain("R→Y→G→C→B→M");
    expect(ja.theory_dice_desc3).toContain("逆順");
    expect(ja.theory_dice_desc3).not.toContain("自由立方体展開図");
  });
});
