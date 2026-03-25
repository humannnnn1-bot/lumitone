import { C, Z, SP, FS, FW, R, SHADOW, DUR } from "../tokens";

interface ToastProps {
  message: string;
  type: "error" | "success" | "info";
}

export function Toast({ message, type }: ToastProps) {
  if (!message) return null;
  const bg = type === "error" ? C.error : type === "success" ? C.success : C.accent;
  return (
    <div role="alert" style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      padding: `${SP.xl}px ${SP["4xl"]}px`, borderRadius: R.xl, background: bg, color: C.textWhite,
      fontSize: FS.xl, fontFamily: "monospace", fontWeight: FW.bold, zIndex: Z.toast,
      boxShadow: SHADOW.toast, pointerEvents: "none",
      animation: `toast-in ${DUR.slow} ease-out`,
    }}>{message}</div>
  );
}
