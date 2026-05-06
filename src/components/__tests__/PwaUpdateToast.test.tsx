// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PwaUpdateToast } from "../PwaUpdateToast";

const labels: Record<string, string> = {
  pwa_update_available: "新しいバージョンがあります",
  pwa_update_reload: "再読み込み",
  pwa_update_reloading: "再読み込み中...",
  pwa_update_dismiss: "更新通知を閉じる",
};

const t = (key: string) => labels[key] ?? key;

describe("PwaUpdateToast", () => {
  it("keeps the update message on one line", () => {
    render(<PwaUpdateToast reloading={false} onReload={vi.fn()} onDismiss={vi.fn()} t={t} />);

    const message = screen.getByText("新しいバージョンがあります");
    expect(message.style.whiteSpace).toBe("nowrap");
    expect(message.style.overflow).toBe("hidden");
    expect(message.style.textOverflow).toBe("ellipsis");
  });
});
