// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FanoRhythmGrid } from "../components/music/FanoRhythmGrid";

describe("FanoRhythmGrid", () => {
  it("labels each row by the Fano line it represents instead of level numbers", () => {
    render(<FanoRhythmGrid playing={false} currentBeat={0} activeLevels={[]} />);

    expect(screen.getByText("{1,2,3}")).toBeTruthy();
    expect(screen.getByText("{3,5,6}")).toBeTruthy();
    expect(screen.queryByText("L1")).toBeNull();
    expect(screen.queryByText("L7")).toBeNull();
  });
});
