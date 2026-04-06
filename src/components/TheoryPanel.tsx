import React, { useState, useCallback } from "react";
import { C, SP, FS, FW } from "../tokens";
import { useTranslation } from "../i18n";
import { PinResetContext } from "./theory/pin-reset";
import { BinaryTable } from "./theory/BinaryTable";
import { ColorDice } from "./theory/ColorDice";
import { FanoPlane } from "./theory/FanoPlane";
import { ColorCube } from "./theory/ColorCube";
import { GrayCodeHex } from "./theory/GrayCodeHex";
import { XorDemo } from "./theory/XorDemo";
import { HammingDiagram } from "./theory/HammingDiagram";
import { Octahedron } from "./theory/Octahedron";
import { LuminanceZigzag } from "./theory/LuminanceZigzag";
import { TetraDecomposition } from "./theory/TetraDecomposition";
import { StellaOctangula } from "./theory/StellaOctangula";
import { ConnectionsSummary, PolyhedraNetwork } from "./theory/ConnectionsSummary";

const S_SECTION: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: SP.lg,
  width: "100%",
};

const S_HEADING: React.CSSProperties = {
  fontSize: 16,
  fontWeight: FW.bold,
  fontFamily: "monospace",
  color: C.accentBright,
  textAlign: "center",
  margin: 0,
};

const S_DESC: React.CSSProperties = {
  fontSize: 13,
  fontFamily: "monospace",
  color: C.textMuted,
  textAlign: "left",
  maxWidth: 480,
  lineHeight: 1.6,
  margin: 0,
  width: "100%",
};

const S_DIVIDER: React.CSSProperties = {
  width: 60,
  height: 1,
  background: C.border,
  border: "none",
  margin: `${SP.xs}px 0`,
};

const S_GROUP_LABEL: React.CSSProperties = {
  fontSize: FS.sm,
  fontFamily: "monospace",
  color: C.textDimmer,
  textAlign: "center",
  letterSpacing: "0.15em",
  margin: 0,
};

interface SectionProps {
  title: string;
  desc: string | string[];
  children: React.ReactNode;
}

function Section({ title, desc, children }: SectionProps) {
  const descs = Array.isArray(desc) ? desc : [desc];
  return (
    <section style={S_SECTION}>
      <h3 className="theory-heading" style={S_HEADING}>
        {title}
      </h3>
      {descs.map((d, i) => (
        <p key={i} className="theory-desc" style={S_DESC}>
          {d}
        </p>
      ))}
      {children}
    </section>
  );
}

export const TheoryPanel = React.memo(function TheoryPanel() {
  const { t } = useTranslation();
  const [hlLevel, setHlLevel] = useState<number | null>(null);
  const onHover = useCallback((lv: number | null) => setHlLevel(lv), []);
  const [pinReset, setPinReset] = useState(0);

  const onBgClick = useCallback((e: React.MouseEvent) => {
    // Only reset if clicking the background, not an interactive child
    if ((e.target as HTMLElement).closest("svg, button")) return;
    setHlLevel(null);
    setPinReset((c) => c + 1);
  }, []);

  return (
    <PinResetContext.Provider value={pinReset}>
      <div
        className="theory-container"
        onClick={onBgClick}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: SP["3xl"],
          width: "100%",
          maxWidth: 560,
          margin: "0 auto",
          boxSizing: "border-box",
          padding: `0 ${SP.lg}px ${SP["4xl"]}px`,
        }}
      >
        {/* Subtitle */}
        <div style={{ fontSize: FS.md, color: C.textDim, textAlign: "center", lineHeight: "14px" }}>{t("label_theory")}</div>

        {/* Page title */}
        <div style={{ textAlign: "center" }}>
          <h2
            className="theory-title"
            style={{ fontSize: FS.title, fontWeight: FW.bold, fontFamily: "monospace", color: C.textPrimary, margin: 0 }}
          >
            {t("theory_title")}
          </h2>
          <p className="theory-desc theory-intro" style={{ ...S_DESC, marginTop: SP.xl, textAlign: "center" }}>
            {t("theory_intro")}
          </p>
        </div>

        {/* Pin hint */}
        <p
          className="theory-hint"
          style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}
        >
          {t("theory_pin_hint")}
        </p>

        {/* ═══════════════════════════════════════
           FOUNDATIONS (基礎)  §1-§3
           ═══════════════════════════════════════ */}
        <div style={S_GROUP_LABEL}>{t("theory_group_foundations")}</div>

        {/* §1 Binary Levels */}
        <Section title={t("theory_binary_title")} desc={t("theory_binary_desc")}>
          <BinaryTable hlLevel={hlLevel} onHover={onHover} />
        </Section>

        <hr style={S_DIVIDER} />

        {/* §2 Luma Zigzag */}
        <Section title={t("theory_zigzag_title")} desc={t("theory_zigzag_desc")}>
          <LuminanceZigzag hlLevel={hlLevel} onHover={onHover} />
        </Section>

        <hr style={S_DIVIDER} />

        {/* §3 Color Die */}
        <Section title={t("theory_dice_title")} desc={[t("theory_dice_desc"), t("theory_dice_desc2")]}>
          <ColorDice hlLevel={hlLevel} onHover={onHover} />
        </Section>

        {/* ═══════════════════════════════════════
           COLOR GEOMETRY (色空間幾何)  §4-§6
           ═══════════════════════════════════════ */}
        <div style={{ ...S_GROUP_LABEL, marginTop: SP["2xl"] }}>{t("theory_group_geometry")}</div>

        {/* §4 XOR Mixing */}
        <Section title={t("theory_xor_title")} desc={t("theory_xor_desc")}>
          <XorDemo hlLevel={hlLevel} onHover={onHover} />
        </Section>

        <hr style={S_DIVIDER} />

        {/* §5 Color Cube */}
        <Section title={t("theory_cube_title")} desc={t("theory_cube_desc")}>
          <ColorCube hlLevel={hlLevel} onHover={onHover} />
        </Section>

        <hr style={S_DIVIDER} />

        {/* §6 Fano Plane */}
        <Section title={t("theory_fano_title")} desc={t("theory_fano_desc")}>
          <FanoPlane hlLevel={hlLevel} onHover={onHover} />
        </Section>

        {/* ═══════════════════════════════════════
           ALGEBRAIC STRUCTURES (代数構造)  §7-§8
           ═══════════════════════════════════════ */}
        <div style={{ ...S_GROUP_LABEL, marginTop: SP["2xl"] }}>{t("theory_group_algebra")}</div>

        {/* §7 Gray Code Cycle */}
        <Section title={t("theory_gray_title")} desc={t("theory_gray_desc")}>
          <GrayCodeHex hlLevel={hlLevel} onHover={onHover} />
        </Section>

        <hr style={S_DIVIDER} />

        {/* §8 Hamming Code */}
        <Section title={t("theory_hamming_title")} desc={t("theory_hamming_desc")}>
          <HammingDiagram hlLevel={hlLevel} onHover={onHover} />
        </Section>

        {/* ═══════════════════════════════════════
           POLYHEDRA (多面体)  §9-§10
           ═══════════════════════════════════════ */}
        <div style={{ ...S_GROUP_LABEL, marginTop: SP["2xl"] }}>{t("theory_group_polyhedra")}</div>

        {/* §9 Chromatic Octahedron */}
        <Section title={t("theory_octa_title")} desc={t("theory_octa_desc")}>
          <Octahedron hlLevel={hlLevel} onHover={onHover} />
        </Section>

        <hr style={S_DIVIDER} />

        {/* §10 Tetrahedra & Stella (merged) */}
        <Section title={t("theory_tetra_stella_title")} desc={t("theory_tetra_stella_desc")}>
          <TetraDecomposition hlLevel={hlLevel} onHover={onHover} />
          <hr style={S_DIVIDER} />
          <StellaOctangula hlLevel={hlLevel} onHover={onHover} />
          <hr style={S_DIVIDER} />
          <PolyhedraNetwork />
        </Section>

        {/* ═══════════════════════════════════════
           SYNTHESIS (総括)  §11
           ═══════════════════════════════════════ */}
        <div style={{ ...S_GROUP_LABEL, marginTop: SP["2xl"] }}>{t("theory_group_synthesis")}</div>

        {/* §11 Connections */}
        <Section title={t("theory_connections_title")} desc={t("theory_connections_desc")}>
          <ConnectionsSummary />
        </Section>
      </div>
    </PinResetContext.Provider>
  );
});
