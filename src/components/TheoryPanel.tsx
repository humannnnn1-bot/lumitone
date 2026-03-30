import React, { useState, useCallback } from "react";
import { C, SP, FS, FW } from "../tokens";
import { useTranslation } from "../i18n";
import { BinaryTable } from "./theory/BinaryTable";
import { FanoPlane } from "./theory/FanoPlane";
import { ColorCube } from "./theory/ColorCube";
import { GrayCodeHex } from "./theory/GrayCodeHex";
import { XorDemo } from "./theory/XorDemo";
import { HammingDiagram } from "./theory/HammingDiagram";
import { ConnectionsSummary } from "./theory/ConnectionsSummary";

const S_SECTION: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: SP.lg,
  width: "100%",
};

const S_HEADING: React.CSSProperties = {
  fontSize: FS["2xl"],
  fontWeight: FW.bold,
  fontFamily: "monospace",
  color: C.accentBright,
  textAlign: "center",
  margin: 0,
};

const S_DESC: React.CSSProperties = {
  fontSize: FS.md,
  fontFamily: "monospace",
  color: C.textMuted,
  textAlign: "center",
  maxWidth: 440,
  lineHeight: 1.6,
  margin: 0,
};

const S_DIVIDER: React.CSSProperties = {
  width: 60,
  height: 1,
  background: C.border,
  border: "none",
  margin: `${SP.lg}px 0`,
};

interface SectionProps {
  title: string;
  desc: string;
  children: React.ReactNode;
}

function Section({ title, desc, children }: SectionProps) {
  return (
    <section style={S_SECTION}>
      <h3 style={S_HEADING}>{title}</h3>
      <p style={S_DESC}>{desc}</p>
      {children}
    </section>
  );
}

export const TheoryPanel = React.memo(function TheoryPanel() {
  const { t } = useTranslation();
  const [hlLevel, setHlLevel] = useState<number | null>(null);
  const onHover = useCallback((lv: number | null) => setHlLevel(lv), []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: SP["3xl"],
        maxWidth: 560,
        margin: "0 auto",
        padding: `${SP.xl}px ${SP.lg}px ${SP["4xl"]}px`,
      }}
    >
      {/* Page title */}
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: FS.title, fontWeight: FW.bold, fontFamily: "monospace", color: C.textPrimary, margin: 0 }}>
          {t("theory_title")}
        </h2>
        <p style={{ ...S_DESC, marginTop: SP.md }}>{t("theory_intro")}</p>
      </div>

      <hr style={S_DIVIDER} />

      <Section title={t("theory_binary_title")} desc={t("theory_binary_desc")}>
        <BinaryTable hlLevel={hlLevel} onHover={onHover} />
      </Section>

      <hr style={S_DIVIDER} />

      <Section title={t("theory_cube_title")} desc={t("theory_cube_desc")}>
        <ColorCube hlLevel={hlLevel} onHover={onHover} />
      </Section>

      <hr style={S_DIVIDER} />

      <Section title={t("theory_xor_title")} desc={t("theory_xor_desc")}>
        <XorDemo />
      </Section>

      <hr style={S_DIVIDER} />

      <Section title={t("theory_gray_title")} desc={t("theory_gray_desc")}>
        <GrayCodeHex hlLevel={hlLevel} onHover={onHover} />
      </Section>

      <hr style={S_DIVIDER} />

      <Section title={t("theory_hamming_title")} desc={t("theory_hamming_desc")}>
        <HammingDiagram hlLevel={hlLevel} onHover={onHover} />
      </Section>

      <hr style={S_DIVIDER} />

      <Section title={t("theory_fano_title")} desc={t("theory_fano_desc")}>
        <FanoPlane hlLevel={hlLevel} onHover={onHover} />
      </Section>

      <hr style={S_DIVIDER} />

      <Section title={t("theory_connections_title")} desc={t("theory_connections_desc")}>
        <ConnectionsSummary />
      </Section>
    </div>
  );
});
