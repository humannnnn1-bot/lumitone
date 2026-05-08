// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LinkedVisualization } from "../LinkedVisualization";
import { bottomProjectionY, rightProjectionX, TH, TW } from "../linked-visualization-geometry";
import { MusicLinkedVisualization } from "../music/MusicLinkedVisualization";

vi.mock("../../i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("LinkedVisualization split", () => {
  it("renders the shared color legend by default", () => {
    render(<LinkedVisualization hueAngle={0} brushLevel={0} />);

    expect(screen.getByText("linkedviz_mode_l0")).toBeTruthy();
    expect(screen.getByText("linkedviz_legend_l0_origin")).toBeTruthy();
    expect(screen.queryByText("Diatonic (7-note)")).toBeNull();
  });

  it("keeps color legend label size stable on hover", () => {
    const { container } = render(<LinkedVisualization hueAngle={0} brushLevel={0} />);
    const label = Array.from(container.querySelectorAll("text")).find((el) => el.textContent?.trim().startsWith("L2"));

    expect(label?.getAttribute("font-size")).toBe("10");
    fireEvent.pointerEnter(label!.closest("g")!);

    const hoveredLabel = Array.from(container.querySelectorAll("text")).find((el) => el.textContent?.trim().startsWith("L2"));
    expect(hoveredLabel?.getAttribute("font-size")).toBe("10");
    expect(hoveredLabel?.getAttribute("font-weight")).toBeNull();
  });

  it("renders interval ratios only through the music wrapper", () => {
    render(<MusicLinkedVisualization hueAngle={0} brushLevel={0} scaleMode="diatonic7" />);

    expect(screen.getByText("linkedviz_mode_l0")).toBeTruthy();
    expect(screen.getByText("Diatonic (7-note)")).toBeTruthy();
    expect(screen.queryByText("linkedviz_legend_l0_origin")).toBeNull();
  });

  it("notifies controlled mode and alpha changes from the toolbar", () => {
    const onOriginModeChange = vi.fn();
    const onAlpha7Change = vi.fn();

    render(
      <LinkedVisualization
        hueAngle={0}
        brushLevel={0}
        alpha0={30}
        alpha7={90}
        onOriginModeChange={onOriginModeChange}
        onAlpha7Change={onAlpha7Change}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "linkedviz_mode_l7" }));
    fireEvent.click(screen.getByRole("button", { name: "linkedviz_in_phase" }));
    fireEvent.click(screen.getByRole("button", { name: "linkedviz_anti_phase" }));

    expect(onOriginModeChange).toHaveBeenCalledWith(7);
    expect(onAlpha7Change).toHaveBeenNthCalledWith(1, 30);
    expect(onAlpha7Change).toHaveBeenNthCalledWith(2, 210);
  });

  it("updates hue from the right and bottom projection drag handles", () => {
    const onHueAngleChange = vi.fn();
    const { container } = render(<LinkedVisualization hueAngle={0} brushLevel={0} onHueAngleChange={onHueAngleChange} />);
    const svg = container.querySelector("svg") as SVGSVGElement;
    const handles = Array.from(svg.querySelectorAll("rect")).filter((rect) => rect.getAttribute("style")?.includes("resize"));
    const rightHandle = handles.find((rect) => rect.getAttribute("style")?.includes("ew-resize"));
    const bottomHandle = handles.find((rect) => rect.getAttribute("style")?.includes("ns-resize"));

    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: TW,
      bottom: TH,
      width: TW,
      height: TH,
      toJSON: () => ({}),
    });
    svg.setPointerCapture = vi.fn();

    expect(rightHandle).toBeTruthy();
    expect(bottomHandle).toBeTruthy();

    fireEvent.pointerDown(rightHandle!, { clientX: rightProjectionX(180), clientY: 90, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: rightProjectionX(240), clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    fireEvent.pointerDown(bottomHandle!, { clientX: 90, clientY: bottomProjectionY(120), pointerId: 2 });

    expect(onHueAngleChange).toHaveBeenNthCalledWith(1, 180);
    expect(onHueAngleChange).toHaveBeenNthCalledWith(2, 240);
    expect(onHueAngleChange).toHaveBeenNthCalledWith(3, 120);
  });

  it("passes active dots and alpha into the custom bottom-right overlay", () => {
    const renderOverlay = vi.fn(({ activeDots, activeAlpha }) => <text>{`overlay ${activeDots.length} ${activeAlpha}`}</text>);

    render(<LinkedVisualization hueAngle={0} brushLevel={0} alpha0={45} showLegend={false} bottomRightOverlay={renderOverlay} />);

    expect(screen.getByText("overlay 6 45")).toBeTruthy();
    expect(renderOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        activeAlpha: 45,
        activeDots: expect.arrayContaining([expect.objectContaining({ lv: 1, act: true })]),
      }),
    );
  });
});
