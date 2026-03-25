// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFocusTrap } from "../hooks/useFocusTrap";

describe("useFocusTrap", () => {
  it("no crash when ref is null", () => {
    const ref = { current: null } as React.RefObject<HTMLElement | null>;
    expect(() => {
      renderHook(() => useFocusTrap(ref, true));
    }).not.toThrow();
  });

  it("no crash when active is false", () => {
    const ref = { current: null } as React.RefObject<HTMLElement | null>;
    expect(() => {
      renderHook(() => useFocusTrap(ref, false));
    }).not.toThrow();
  });

  it("focuses first focusable element when active", () => {
    const container = document.createElement("div");
    const btn1 = document.createElement("button");
    btn1.textContent = "First";
    const btn2 = document.createElement("button");
    btn2.textContent = "Second";
    container.appendChild(btn1);
    container.appendChild(btn2);
    document.body.appendChild(container);

    const ref = { current: container } as React.RefObject<HTMLElement | null>;
    renderHook(() => useFocusTrap(ref, true));

    expect(document.activeElement).toBe(btn1);
    document.body.removeChild(container);
  });

  it("calls onEscape when Escape key is pressed", () => {
    const container = document.createElement("div");
    const btn = document.createElement("button");
    container.appendChild(btn);
    document.body.appendChild(container);

    const onEscape = vi.fn();
    const ref = { current: container } as React.RefObject<HTMLElement | null>;
    renderHook(() => useFocusTrap(ref, true, onEscape));

    container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEscape).toHaveBeenCalledTimes(1);

    document.body.removeChild(container);
  });

  it("traps Tab at last element back to first", () => {
    const container = document.createElement("div");
    const btn1 = document.createElement("button");
    btn1.textContent = "First";
    const btn2 = document.createElement("button");
    btn2.textContent = "Last";
    container.appendChild(btn1);
    container.appendChild(btn2);
    document.body.appendChild(container);

    const ref = { current: container } as React.RefObject<HTMLElement | null>;
    renderHook(() => useFocusTrap(ref, true));

    // Focus the last element
    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    // Press Tab on last element should wrap to first
    const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    const preventSpy = vi.spyOn(tabEvent, "preventDefault");
    container.dispatchEvent(tabEvent);

    expect(preventSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(btn1);

    document.body.removeChild(container);
  });

  it("traps Shift+Tab at first element back to last", () => {
    const container = document.createElement("div");
    const btn1 = document.createElement("button");
    btn1.textContent = "First";
    const btn2 = document.createElement("button");
    btn2.textContent = "Last";
    container.appendChild(btn1);
    container.appendChild(btn2);
    document.body.appendChild(container);

    const ref = { current: container } as React.RefObject<HTMLElement | null>;
    renderHook(() => useFocusTrap(ref, true));

    // Focus should be on first element
    expect(document.activeElement).toBe(btn1);

    // Press Shift+Tab on first element should wrap to last
    const shiftTabEvent = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true });
    const preventSpy = vi.spyOn(shiftTabEvent, "preventDefault");
    container.dispatchEvent(shiftTabEvent);

    expect(preventSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(btn2);

    document.body.removeChild(container);
  });

  it("does not trap focus when not active", () => {
    const container = document.createElement("div");
    const btn = document.createElement("button");
    container.appendChild(btn);
    document.body.appendChild(container);

    const ref = { current: container } as React.RefObject<HTMLElement | null>;
    renderHook(() => useFocusTrap(ref, false));

    // Should not auto-focus
    expect(document.activeElement).not.toBe(btn);

    document.body.removeChild(container);
  });
});
