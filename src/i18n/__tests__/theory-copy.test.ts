import { describe, expect, it } from "vitest";
import { en } from "../en";
import { ja } from "../ja";

describe("theory copy high-risk claims", () => {
  it("defines the Venn characteristic function by channel membership", () => {
    expect(ja.theory_venn_desc).toContain("特性関数 χ_A(x)");
    expect(ja.theory_venn_desc).toContain("x ∈ A なら 1");
    expect(ja.theory_venn_desc).not.toContain("A ∈ {G,R,B} なら 1");
  });

  it("keeps Boolean-color identities scoped to the cases where they are true", () => {
    expect(en.theory_dice_footer_demorgan).toMatch(/disjoint colors/i);
    expect(en.theory_dice_footer_demorgan).toContain("a ∧ b = 0");
    expect(en.theory_conn_boolean_hook).toContain("a⊕b=a∨b");
    expect(en.theory_dice_footer_subtractive).toContain("a ∨ b = 7");
    expect(en.theory_dice_footer_subtractive).toContain("a + b - 7 = a ∧ b");
    expect(en.theory_xor_desc).toContain("a + b = (a ⊕ b) + 2(a ∧ b)");
    expect(en.theory_xor_desc.toLowerCase()).toContain("boolean-and identities");
    expect(en.theory_xor_desc.toLowerCase()).not.toContain("carry correction");

    expect(ja.theory_conn_boolean_hook).toContain("重なりのない2色");
    expect(ja.theory_xor_desc).toContain("ブール AND の恒等式");
    expect(ja.theory_xor_desc).not.toContain("桁あふれ補正");
  });

  it("describes Hamming/Fano links as position labels and subspaces, not channel flips or literal slices", () => {
    expect(en.theory_hamming_desc.toLowerCase()).toContain("position");
    expect(en.theory_hamming_desc).toContain("parity-bit positions");
    expect(en.theory_hamming_desc).toContain("parity-check rows");
    expect(en.theory_hamming_desc2).toContain("parity-check row labeled B");
    expect(en.theory_hamming_desc2).not.toContain("Blue(1) checks");
    expect(en.theory_hamming_desc.toLowerCase()).not.toContain("single channel flips");
    expect(en.theory_fano_desc.toLowerCase()).toContain("zero vector");
    expect(en.theory_hamming_desc.toLowerCase()).toContain("same nonzero 3-bit labels");
    expect(en.theory_conn_extended).toContain("extra coordinate for overall parity");
    expect(en.theory_conn_extended).toContain("does not make the colors codewords");
    expect(en.theory_conn_cube_geometry_hook.toLowerCase()).toContain("two-dimensional subspace");
    expect(en.theory_conn_cube_geometry_hook).toContain("not a Euclidean plane");
    expect(en.theory_conn_cube_geometry_hook.toLowerCase()).not.toContain("7 fano lines are planar cross-sections");

    expect(ja.theory_hamming_desc).toContain("位置");
    expect(ja.theory_hamming_desc).toContain("パリティビット位置");
    expect(ja.theory_hamming_desc).toContain("パリティ検査行");
    expect(ja.theory_hamming_desc2).toContain("パリティ検査行 B");
    expect(ja.theory_hamming_desc2).not.toContain("Blue(1) は");
    expect(ja.theory_fano_desc).toContain("零ベクトル");
    expect(ja.theory_conn_extended).toContain("座標");
    expect(ja.theory_conn_cube_geometry_hook).toContain("2次元部分空間");
    expect(ja.theory_conn_cube_geometry_hook).toContain("ユークリッド平面ではありません");
  });

  it("keeps the color-polyhedra claims non-literal where the UI is schematic", () => {
    expect(en.theory_octa_desc.toLowerCase()).not.toContain("visible as the edge gradient’s midpoint");
    expect(en.theory_octa_desc.toLowerCase()).not.toContain("literal rgb midpoint");
    expect(en.theory_octa_desc).toContain("B↔Y, R↔C, M↔G");
    expect(en.theory_octa_desc2).toContain("6 chromatic XOR results appear exactly twice");
    expect(en.theory_conn_polyhedra_desc).toContain("the four polyhedral structures in this tab");
    expect(en.theory_conn_polyhedra_desc).not.toContain("§9");

    expect(ja.theory_octa_desc).not.toContain("中間点として視認できます");
    expect(ja.theory_octa_desc).toContain("B↔Y、R↔C、M↔G");
    expect(ja.theory_octa_desc2).toContain("6つの有彩色 XOR 結果が各2回ずつ");
    expect(ja.theory_conn_polyhedra_desc).toContain("本タブの4つの多面体");
    expect(ja.theory_conn_polyhedra_desc).not.toContain("§9");
  });

  it("states luma ordering and hue-order uniqueness with the intended proof boundaries", () => {
    expect(en.theory_binary_desc).toContain("numeric order and ITU-R BT.601 luma order agree");
    expect(en.theory_binary_desc).toContain("bit2=Green, bit1=Red, bit0=Blue, namely GRB");
    expect(en.theory_binary_desc).toContain("0.587 > 0.299 + 0.114");
    expect(en.theory_binary_luma_formula).toContain("Y′ = 0.299R + 0.587G + 0.114B");
    expect(en.theory_binary_luma_complement).toContain("Y′ₖ + Y′₇₋ₖ = 255");
    expect(en.theory_zigzag_desc).toContain("Y′(h) + Y′(h+180°) = 255");
    expect(en.theory_binary_desc).not.toContain("consequence of human color vision");
    expect(en.theory_dice_desc).toContain("c ↦ c ⊕ 7 reverses luma order");
    expect(en.theory_dice_desc3).toContain("11 free cube nets");
    expect(en.theory_dice_desc3).toContain("face-adjacency tree");
    expect(en.theory_dice_desc3).toContain("R→Y→G→C→B→M");
    expect(en.theory_dice_desc3).toContain("equivalently its reverse");

    expect(ja.theory_binary_desc).toContain("番号順と ITU-R BT.601 luma 順が一致する割当");
    expect(ja.theory_binary_desc).toContain("bit2=Green, bit1=Red, bit0=Blue、つまり GRB だけ");
    expect(ja.theory_binary_luma_formula).toContain("Y′ = 0.299R + 0.587G + 0.114B");
    expect(ja.theory_binary_luma_complement).toContain("Y′ₖ + Y′₇₋ₖ = 255");
    expect(ja.theory_zigzag_desc).toContain("Y′(h) + Y′(h+180°) = 255");
    expect(ja.theory_binary_desc).not.toContain("人間の色覚の帰結です");
    expect(ja.theory_dice_desc).toContain("補色写像 c ↦ c ⊕ 7 はルマ順を反転");
    expect(ja.theory_dice_desc3).toContain("11種類の立方体展開図（回転・反転は同一視）");
    expect(ja.theory_dice_desc3).toContain("R→Y→G→C→B→M");
    expect(ja.theory_dice_desc3).toContain("逆順");
  });

  it("keeps reviewed color labels stable where abbreviation changes would alter meaning", () => {
    expect(en.theory_intro).toContain("encoded as the 3-bit vector `[G,R,B]`");
    expect(ja.theory_intro).toContain("3ビットベクトル `[G,R,B]` として符号化します");
    expect(en.theory_tetra_desc).toContain("T0 (even weight: K, M, C, Y)");
    expect(en.theory_tetra_desc).not.toContain("T0 (even weight: Black, M, C, Y)");
    expect(en.theory_dice_tetra_subgroup).toContain("T0 = {K, M, C, Y}");
    expect(ja.theory_tetra_desc).toContain("T0（偶数重み：K, M, C, Y）");
    expect(ja.theory_hamming_desc2).toContain("Blue=1");
    expect(ja.theory_hamming_desc2).not.toContain("青(1)");
  });
});
