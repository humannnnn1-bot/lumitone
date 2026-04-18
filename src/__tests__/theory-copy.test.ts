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

  it("labels die views as XOR and AND readings", () => {
    expect(en.theory_dice_additive_col).toBe("XOR view (additive reading)");
    expect(en.theory_dice_subtractive_col).toBe("AND view (subtractive reading)");

    expect(ja.theory_dice_additive_col).toBe("XORの読み（加法的）");
    expect(ja.theory_dice_subtractive_col).toBe("ANDの読み（減法的）");
  });

  it("describes Hamming as a position-error demo", () => {
    expect(en.theory_hamming_desc.toLowerCase()).toContain("position");
    expect(en.theory_hamming_flip.toLowerCase()).toContain("position");
    expect(en.theory_hamming_desc.toLowerCase()).not.toContain("single channel flips");

    expect(ja.theory_hamming_desc).toContain("位置");
    expect(ja.theory_hamming_flip).toContain("位置");
    expect(ja.theory_hamming_desc).not.toContain("チャンネル");
  });

  it("explains why Black is absent from the Fano plane and reuses those labels in Hamming", () => {
    expect(en.theory_fano_desc.toLowerCase()).toContain("zero vector");
    expect(en.theory_fano_desc).toContain("Black (0)");
    expect(en.theory_hamming_desc.toLowerCase()).toContain("same nonzero 3-bit labels");

    expect(ja.theory_fano_desc).toContain("零ベクトル");
    expect(ja.theory_fano_desc).toContain("Black(0)");
    expect(ja.theory_hamming_desc).toContain("同じ非零3ビットラベル");
  });

  it("clarifies that the [8,4,4] note is about coordinates, not codewords", () => {
    expect(en.theory_conn_extended.toLowerCase()).toContain("coordinate");
    expect(en.theory_conn_extended.toLowerCase()).toContain("not codewords");

    expect(ja.theory_conn_extended).toContain("座標");
    expect(ja.theory_conn_extended).toContain("符号語の各座標位置");
  });

  it("describes the cube-Fano link as subspaces rather than seven literal plane slices", () => {
    expect(en.theory_conn_cube_geometry_hook.toLowerCase()).toContain("two-dimensional subspaces");
    expect(en.theory_conn_cube_geometry_hook.toLowerCase()).toContain("even-parity tetrahedron");
    expect(en.theory_conn_cube_geometry_hook.toLowerCase()).not.toContain("7 fano lines are planar cross-sections");

    expect(ja.theory_conn_cube_geometry_hook).toContain("2次元部分空間");
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

  it("keeps reviewed Japanese copy precise and natural", () => {
    expect(ja.theory_intro).toContain("本タブの出発点となる設計選択です");
    expect(ja.theory_binary_desc).toContain("人間の色覚の帰結です");
    expect(ja.theory_binary_desc).toContain("0.587 > 0.299 + 0.114");
    expect(ja.theory_binary_desc).toContain("0.299 > 0.114");
    expect(en.theory_binary_desc).toContain("0.587 > 0.299 + 0.114");
    expect(en.theory_binary_desc).toContain("0.299 > 0.114");
    expect(ja.theory_zigzag_desc).toContain("円周上では");
    expect(ja.theory_gray_desc).toContain("原色から生成される三点線");
    expect(ja.theory_conn_cube_geometry_hook).toContain("ユークリッド的な立方体");
    expect(ja.theory_conn_polyhedra_desc).toContain("本タブの4つの多面体");
    expect(ja.theory_conn_polyhedra_desc).not.toContain("§9");
  });

  it("keeps Japanese Theory prose in the agreed style", () => {
    expect(ja.theory_intro).toBe(
      "CHROMALUMの8段階ルマレベルは、RGBチャンネルを3ビット2進数として符号化します。これは本タブの出発点となる設計選択です。ここから、カラーキューブ、グレイコード、ハミング符号、ファノ平面が GF(2)³ の構造として現れます。GF(2) は 0 と 1 だけから成る最小の有限体であり、1+1=0 が成り立ちます。GF(2)³ はその3次元ベクトル空間であり、8つのベクトルが8色に対応します。",
    );
    expect(ja.theory_cube_desc).toContain("立方体");
    expect(ja.theory_octa_desc).toContain("八面体");
    expect(ja.theory_tetra_desc).toContain("四面体分解");
    expect(ja.theory_tetra_desc).toContain("T0（偶数重み：K, M, C, Y）");
    expect(ja.theory_tetra_desc).not.toContain("T0（偶数重み：Black, M, C, Y）");
    expect(en.theory_tetra_desc).toContain("T0 (even weight: K, M, C, Y)");
    expect(en.theory_tetra_desc).not.toContain("T0 (even weight: Black, M, C, Y)");
    expect(en.theory_dice_tetra_subgroup).toContain("T0 = {K, M, C, Y}");
    expect(en.theory_dice_tetra_subgroup).not.toContain("T0 = {Black, M, C, Y}");
    expect(ja.theory_dice_tetra_subgroup).toContain("T0 = {K, M, C, Y}");
    expect(ja.theory_stella_desc).toContain("星形八面体");
    expect(ja.theory_cube_desc).toContain("Black(0)");
    expect(ja.theory_hamming_desc2).toContain("Blue(1)");
    expect(ja.theory_hamming_desc2).not.toContain("青(1)");
    expect(ja.theory_dice_desc2).toContain("定理です：");
    expect(ja.theory_dice_desc3).toContain("証明の要点：");
    expect(ja.theory_conn_polyhedra_desc).toContain("可換です：");
    expect(ja.theory_dice_desc2).not.toContain("定理です:");
    expect(ja.theory_dice_desc3).not.toContain("証明の要点:");
    expect(ja.theory_conn_polyhedra_desc).not.toContain("可換です:");
  });

  it("keeps the polyhedra section reference language-independent", () => {
    expect(en.theory_zigzag_desc).toContain("On the hue circle");
    expect(en.theory_conn_polyhedra_desc).toContain("the four polyhedra in this tab");
    expect(en.theory_conn_polyhedra_desc).not.toContain("§9");
    expect(en.theory_stella_desc).toContain("edge set of K₈");
    expect(en.theory_stella_desc).not.toContain("K₈ = Cube + Color Star + Complements");
  });
});
