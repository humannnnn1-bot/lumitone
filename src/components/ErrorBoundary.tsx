import React, { Component } from "react";
import { useTranslation } from "../i18n";
import { C, SP, FS, R } from "../tokens";

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
  componentStack: string | null;
}

function ErrorFallback({ error, componentStack, onRetry }: { error: Error; componentStack: string | null; onRetry: () => void }) {
  const { t } = useTranslation();
  const [showStack, setShowStack] = React.useState(false);
  return (
    <div
      style={{
        padding: SP["5xl"],
        textAlign: "center",
        color: C.textWhite,
        background: C.bgError,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h2 style={{ marginBottom: 12 }}>{t("error_occurred")}</h2>
      <p style={{ color: C.textSecondary, fontSize: FS["2xl"], marginBottom: SP["3xl"] }}>{error.message}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onRetry}
          style={{
            padding: "8px 20px",
            background: C.errorBtnBg,
            color: C.textWhite,
            border: "none",
            borderRadius: R.lg,
            cursor: "pointer",
            fontSize: FS["2xl"],
          }}
        >
          {t("btn_retry")}
        </button>
        {componentStack && (
          <button
            onClick={() => setShowStack((s) => !s)}
            style={{
              padding: "8px 20px",
              background: C.retryBtnBg,
              color: C.textSecondary,
              border: `1px solid ${C.borderHover}`,
              borderRadius: R.lg,
              cursor: "pointer",
              fontSize: FS.xl,
            }}
          >
            {showStack ? t("error_hide_details") : t("error_show_details")}
          </button>
        )}
      </div>
      {showStack && componentStack && (
        <pre
          style={{
            marginTop: SP["3xl"],
            padding: SP["2xl"],
            background: C.bgCode,
            border: `1px solid ${C.border}`,
            borderRadius: R.lg,
            color: C.textSecondary,
            fontSize: FS.md,
            textAlign: "left",
            maxWidth: 600,
            maxHeight: 300,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {error.stack}
          {"\n\nComponent Stack:"}
          {componentStack}
        </pre>
      )}
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Lumitone ErrorBoundary:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          componentStack={this.state.componentStack}
          onRetry={() => this.setState({ error: null, componentStack: null })}
        />
      );
    }
    return this.props.children;
  }
}
