import React, { useRef, useEffect } from "react";
import { C, R } from "../../tokens";

interface OscilloscopeProps {
  analyserNode: AnalyserNode | null;
}

const W = 420;
const H = 80;
const BG = "#0a0a1a";
const LINE_COLOR = "#00ff88";

export const Oscilloscope = React.memo(function Oscilloscope({ analyserNode }: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // HiDPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const bufLen = analyserNode ? analyserNode.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufLen);

    const draw = () => {
      if (analyserNode) analyserNode.getByteTimeDomainData(dataArray);

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = LINE_COLOR;
      ctx.beginPath();

      const sliceW = W / bufLen;
      for (let i = 0; i < bufLen; i++) {
        const v = (analyserNode ? dataArray[i] : 128) / 128.0;
        const y = (v * H) / 2;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      // Reset scale for next mount
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
  }, [analyserNode]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        maxWidth: W,
        aspectRatio: `${W}/${H}`,
        borderRadius: R.md,
        border: `1px solid ${C.border}`,
      }}
    />
  );
});
