import type { CSSProperties, ReactNode } from "react";

import { C, Z, SP, FS, FW, R, SHADOW, DUR, FONT } from "../styles/tokens";

interface ToastProps {
  message: string;
  type: "error" | "success" | "info";
}

const FILE_MESSAGE_PREFIXES = ["画像を長押しして保存してください: ", "保存しました: ", "Long-press to save: ", "Saved: "] as const;

const S_TOAST_BASE: CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: "calc(100vw - 24px)",
  boxSizing: "border-box",
  padding: `${SP.xl}px ${SP["4xl"]}px`,
  borderRadius: R.xl,
  color: C.textWhite,
  fontSize: FS.xl,
  fontFamily: FONT.mono,
  fontWeight: FW.bold,
  lineHeight: 1.35,
  textAlign: "center",
  zIndex: Z.toast,
  boxShadow: SHADOW.toast,
  pointerEvents: "none",
  animation: `toast-in ${DUR.slow} ease-out`,
};

const S_ONE_LINE: CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const S_FILE_MESSAGE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  justifyContent: "center",
  columnGap: SP.lg,
  rowGap: SP.xs,
  maxWidth: "100%",
};

const S_FILE_LABEL: CSSProperties = {
  flex: "0 0 auto",
  whiteSpace: "nowrap",
};

const S_FILE_NAME: CSSProperties = {
  minWidth: 0,
  maxWidth: "100%",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

function parseFileMessage(message: string): { label: string; fileName: string } | null {
  const prefix = FILE_MESSAGE_PREFIXES.find((candidate) => message.startsWith(candidate));
  if (!prefix) return null;
  return {
    label: prefix.trimEnd(),
    fileName: message.slice(prefix.length),
  };
}

function splitJapaneseSentences(message: string): string[] {
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < message.length; i++) {
    if (message[i] !== "。") continue;
    sentences.push(message.slice(start, i + 1).trim());
    start = i + 1;
  }

  const tail = message.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences.length > 1 ? sentences : [message];
}

function splitEnglishSentences(message: string): string[] {
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < message.length; i++) {
    if (message[i] !== "." || message[i + 1] !== " ") continue;
    sentences.push(message.slice(start, i + 1).trim());
    start = i + 2;
  }

  const tail = message.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences.length > 1 ? sentences : [message];
}

function renderToastMessage(message: string): ReactNode {
  const fileMessage = parseFileMessage(message);
  if (fileMessage) {
    return (
      <span style={S_FILE_MESSAGE}>
        <span style={S_FILE_LABEL}>{fileMessage.label}</span>
        <span style={S_FILE_NAME}>{fileMessage.fileName}</span>
      </span>
    );
  }

  const sentences = message.includes("。") ? splitJapaneseSentences(message) : splitEnglishSentences(message);
  if (sentences.length > 1) {
    return sentences.map((sentence, index) => (
      <span key={`${index}:${sentence}`} style={S_ONE_LINE}>
        {sentence}
      </span>
    ));
  }

  return <span style={S_ONE_LINE}>{message}</span>;
}

export function Toast({ message, type }: ToastProps) {
  if (!message) return null;
  const bg = type === "error" ? C.error : type === "success" ? C.success : C.accent;
  return (
    <div
      role="alert"
      aria-label={message}
      style={{
        ...S_TOAST_BASE,
        background: bg,
      }}
    >
      {renderToastMessage(message)}
    </div>
  );
}
