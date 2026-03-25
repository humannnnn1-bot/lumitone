import React, { useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";

import { isShapeTool } from "./constants";
import { renderBuf } from "./render-buf";
import { useSyncRef } from "./hooks/useSyncRef";
import { usePanZoom } from "./hooks/usePanZoom";
import { useCanvasDrawing } from "./hooks/useCanvasDrawing";
import { useGlazeDrawing } from "./hooks/useGlazeDrawing";
import { useStablePanZoomHandlers, useStableDrawingHandlers } from "./hooks/useStableHandlers";
import { useFileDrop } from "./hooks/useFileDrop";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useExport } from "./hooks/useExport";
import { useAppState } from "./hooks/useAppState";
import { DrawingContextProvider } from "./contexts/DrawingContext";
import { S_TAB_ACTIVE, S_TAB_INACTIVE } from "./styles";
import { C, Z, SP, FS, FW } from "./tokens";
import { Toast } from "./components/Toast";
import { SourcePanel } from "./components/SourcePanel";
import { ColorPanel } from "./components/ColorPanel";
import { GlazePanel } from "./components/GlazePanel";
import { HelpModal } from "./components/HelpModal";
import { NewCanvasModal } from "./components/NewCanvasModal";
import { PromptModal } from "./components/PromptModal";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { AnalyzePanel } from "./components/AnalyzePanel";
import { GalleryPanel } from "./components/GalleryPanel";
import { HexTab } from "./components/HexTab";
import { useTranslation } from "./i18n";

/* ═══════════════════════════════════════════
   LAYOUT STYLE CONSTANTS
   ═══════════════════════════════════════════ */
const TAB_KEYS = ["tab_source", "tab_color", "tab_hex", "tab_glaze", "tab_stats", "tab_gallery"] as const;

const S_ROOT: React.CSSProperties = { minHeight: "100vh", background: C.bgRoot, color: C.textPrimary, fontFamily: "monospace", padding: SP["3xl"], paddingTop: SP.xl, paddingBottom: 80 };
const S_HEADER: React.CSSProperties = { textAlign: "center", marginBottom: SP["2xl"] };
const S_TITLE: React.CSSProperties = { fontSize: 24, fontWeight: FW.bold, margin: `0 0 ${SP["2xl"]}px`, background: C.titleGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: SP.xs };
const S_STATUS: React.CSSProperties = { fontSize: FS.sm, color: C.textFaint, marginTop: 2 };
const S_HELP_LINK: React.CSSProperties = { cursor: "pointer", color: C.textDimmest, textDecoration: "underline" };
const S_TABLIST: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 1, marginBottom: SP["2xl"], maxWidth: "100%" };
const S_TAB_CENTER: React.CSSProperties = { display: "flex", justifyContent: "center", width: "100%" };
const S_DROP_OVERLAY: React.CSSProperties = { position: "fixed", inset: 0, background: C.bgDrop, border: `3px dashed ${C.accent}`, zIndex: Z.dropOverlay, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" };
const S_DROP_TEXT: React.CSSProperties = { fontSize: FS.title, color: C.accentBright, fontWeight: FW.bold };
const S_SR_ONLY: React.CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" };

interface AppContentProps {
  app: ReturnType<typeof useAppState>;
  panZoom: ReturnType<typeof usePanZoom>;
  announce: (msg: string) => void;
  ariaLiveRef: React.MutableRefObject<HTMLDivElement | null>;
  t: import("./i18n").TranslationFn;
}

function AppContent({ app, panZoom, announce, ariaLiveRef, t }: AppContentProps) {
  const {
    state, dispatch, cvs, cc, ccDispatch,
    brushLevel, setBrushLevel, brushSize, setBrushSize,
    tool, setTool,
    activeTab, setActiveTab,
    showHelp, setShowHelp,
    toast, showToast,
    showNewCanvas, setShowNewCanvas,
    locked,
    mapMode, setMapMode,
    hueAngle, setHueAngle, glazeTool, setGlazeTool, directCandidates, setDirectCandidates,
    promptState,
    colorLUT, displayW, displayH,
    toggleLock, handleRandomize, handleUnlockAll, patternInfo,
    requestFilename, handlePromptConfirm, handlePromptCancel,
  } = app;

  const hist = state.hist;

  const prvRef = useRef<HTMLCanvasElement | null>(null);
  const glazePrvRef = useRef<HTMLCanvasElement | null>(null);
  const hexPrvRef = useRef<HTMLCanvasElement | null>(null);
  const srcWrapRef = useRef<HTMLDivElement | null>(null);
  const prvWrapRef = useRef<HTMLDivElement | null>(null);
  const glazeWrapRef = useRef<HTMLDivElement | null>(null);
  const helpRef = useRef<HTMLDivElement | null>(null);

  const sharedSchedCursorRef = useRef<(() => void) | null>(null);

  const drawing = useCanvasDrawing({
    cvs, dispatch, colorLUT, cc,
    brushLevel, brushSize, tool,
    prvRef,
    setBrushLevel,
  });

  const glazeDrawing = useGlazeDrawing({
    cvs, dispatch, colorLUT,
    hueAngle, setHueAngle, glazeTool, brushSize,
    prvRef: glazePrvRef,
    directCandidates,
  });

  // Bridge schedCursorRef from drawing hook to shared ref used by panZoom
  useLayoutEffect(() => {
    sharedSchedCursorRef.current = drawing.schedCursorRef.current;
  });

  // Cleanup RAF on unmount
  useEffect(() => () => {
    if (drawing.cursorRafRef.current) cancelAnimationFrame(drawing.cursorRafRef.current);
    if (glazeDrawing.cursorRafRef.current) cancelAnimationFrame(glazeDrawing.cursorRafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup-only effect, refs are stable
  }, []);

  const brushSizeRef = useSyncRef(brushSize);

  const fileDrop = useFileDrop(
    dispatch, panZoom.setZoom, panZoom.setPan, showToast, announce, t,
  );

  // Wheel listener (non-passive)
  useEffect(() => {
    const s = srcWrapRef.current, p = prvWrapRef.current, g = glazeWrapRef.current;
    const opts: AddEventListenerOptions = { passive: false };
    if (s) s.addEventListener('wheel', panZoom.onWheel, opts);
    if (p) p.addEventListener('wheel', panZoom.onWheel, opts);
    if (g) g.addEventListener('wheel', panZoom.onWheel, opts);
    return () => {
      if (s) s.removeEventListener('wheel', panZoom.onWheel, opts);
      if (p) p.removeEventListener('wheel', panZoom.onWheel, opts);
      if (g) g.removeEventListener('wheel', panZoom.onWheel, opts);
    };
  }, [panZoom.onWheel]);

  // Render buffer on state change
  useLayoutEffect(() => {
    if (drawing.drawingRef.current || glazeDrawing.drawingRef.current) return;
    const s = drawing.srcRef.current, p = prvRef.current, hp = hexPrvRef.current;
    if (!s && !p && !hp) return;
    let needReset = false;
    if (s && (s.width !== cvs.w || s.height !== cvs.h)) { s.width = cvs.w; s.height = cvs.h; needReset = true; }
    if (p && (p.width !== cvs.w || p.height !== cvs.h)) { p.width = cvs.w; p.height = cvs.h; needReset = true; }
    if (needReset) drawing.imgCacheRef.current = { src: null, prv: null, s32: null, p32: null };
    renderBuf(cvs.data, cvs.w, cvs.h, colorLUT, s, p || hp, drawing.imgCacheRef.current);
    if (hp) {
      if (hp.width !== cvs.w || hp.height !== cvs.h) { hp.width = cvs.w; hp.height = cvs.h; }
      const hctx = hp.getContext("2d");
      if (hctx && drawing.imgCacheRef.current.prv) {
        hctx.putImageData(drawing.imgCacheRef.current.prv, 0, 0);
      }
    }
    // Also render glaze tab canvas (may be null if tab not mounted yet)
    renderGlazeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable, renderGlazeCanvas captured via closure
  }, [cvs, colorLUT, activeTab]);

  const renderGlazeCanvas = useCallback(() => {
    const gp = glazePrvRef.current;
    if (!gp) return;
    if (gp.width !== cvs.w || gp.height !== cvs.h) { gp.width = cvs.w; gp.height = cvs.h; glazeDrawing.imgCacheRef.current = { src: null, prv: null, s32: null, p32: null }; }
    renderBuf(cvs.data, cvs.w, cvs.h, colorLUT, null, gp, glazeDrawing.imgCacheRef.current, undefined, cvs.colorMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- imgCacheRef is a stable ref
  }, [cvs, colorLUT]);

  useEffect(() => {
    if (activeTab === 3) renderGlazeCanvas();
  }, [activeTab, renderGlazeCanvas]);

  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);

  const { saveColor, saveGlaze } = useExport(cvs, colorLUT, showToast, t);

  const handleKbSave = useCallback(() => {
    saveColor(prvRef, `chromalum_color_${Date.now()}.png`);
  }, [saveColor, prvRef]);

  const handleKbSaveAs = useCallback(() => {
    requestFilename(`chromalum_color_${Date.now()}`).then(name => {
      if (name) saveColor(prvRef, name.endsWith(".png") ? name : name + ".png");
    });
  }, [saveColor, prvRef, requestFilename]);

  useKeyboardShortcuts(
    setTool, setBrushLevel, setBrushSize,
    dispatch, announce, panZoom.endPan, setShowHelp,
    panZoom.setCursorMode, panZoom.spaceRef, panZoom.panningRef,
    brushSizeRef, setShowNewCanvas, t,
    panZoom.setZoom, handleKbSave, handleKbSaveAs,
  );

  const handleClear = useCallback(() => {
    if (hist[0] !== cvs.w * cvs.h) {
      dispatch({ type: "clear" });
      showToast(t("toast_cleared"), "info");
    }
  }, [hist, cvs.w, cvs.h, dispatch, showToast, t]);

  const canvasTransform = useMemo(() => ({
    imageRendering: "pixelated" as const,
    transform: `scale(${panZoom.zoom}) translate(${panZoom.pan.x * displayW / cvs.w}px,${panZoom.pan.y * displayH / cvs.h}px)`,
    transformOrigin: "center center",
  }), [panZoom.zoom, panZoom.pan.x, panZoom.pan.y, displayW, displayH, cvs.w, cvs.h]);

  const canvasCursor = panZoom.cursorMode === "grabbing" ? "grabbing" : panZoom.cursorMode === "grab" ? "grab" : tool === "fill" ? "crosshair" : isShapeTool(tool) ? "crosshair" : "none";

  const onPointerLeave = useCallback((e: React.PointerEvent) => {
    const el = drawing.srcRef.current;
    if (el && drawing.drawingRef.current) {
      try {
        if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
          drawing.clearCursor(); return;
        }
      } catch (err) { console.warn("CHROMALUM: pointerCapture check failed:", err); }
    }
    drawing.onUp(); drawing.clearCursor();
  }, [drawing]);

  const onPointerLeavePrv = useCallback((e: React.PointerEvent) => {
    const el = prvRef.current;
    if (el && drawing.drawingRef.current) {
      try {
        if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId)) {
          drawing.clearCursorPrv(); return;
        }
      } catch (err) { console.warn("CHROMALUM: pointerCapture check failed:", err); }
    }
    drawing.onUp(); drawing.clearCursorPrv();
  }, [drawing]);

  const schedCursorFn = useCallback(() => {
    drawing.schedCursorRef.current?.();
  }, [drawing.schedCursorRef]);

  const toolState = useMemo(() => ({
    tool, setTool, brushLevel, setBrushLevel, brushSize, setBrushSize,
  }), [tool, setTool, brushLevel, setBrushLevel, brushSize, setBrushSize]);

  const viewState = useMemo(() => ({
    zoom: panZoom.zoom, setZoom: panZoom.setZoom, setPan: panZoom.setPan,
    displayW, displayH, canvasTransform, canvasCursor,
  }), [panZoom.zoom, panZoom.setZoom, panZoom.setPan, displayW, displayH, canvasTransform, canvasCursor]);

  const saveActionsObj = useMemo(() => ({
    saveColor, saveGlaze,
  }), [saveColor, saveGlaze]);

  const handleNewCanvas = useCallback(() => setShowNewCanvas(true), [setShowNewCanvas]);
  const handleNewCanvasConfirm = useCallback((w: number, h: number) => {
    if (state.undoStack.length > 0) {
      showToast(t("toast_undo_history_cleared"), "info");
    }
    dispatch({ type: "new_canvas", w, h });
    panZoom.setZoom(1);
    panZoom.setPan({ x: 0, y: 0 });
    setShowNewCanvas(false);
    showToast(t("toast_new_canvas_created", w, h), "success");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- panZoom setters are stable
  }, [state.undoStack.length, panZoom.setZoom, panZoom.setPan, dispatch, setShowNewCanvas, showToast, t]);
  const handleNewCanvasCancel = useCallback(() => setShowNewCanvas(false), [setShowNewCanvas]);

  // Stable handler objects: use refs to avoid recreating on every render
  const panZoomHandlersRef = useStablePanZoomHandlers({
    setZoom: panZoom.setZoom, setPan: panZoom.setPan, schedCursorRef: sharedSchedCursorRef,
    spaceRef: panZoom.spaceRef, panningRef: panZoom.panningRef,
    startPan: panZoom.startPan, movePan: panZoom.movePan, endPan: panZoom.endPan,
  });
  const panZoomHandlers = panZoomHandlersRef.current;

  const drawingHandlersRef = useStableDrawingHandlers({
    onDownPrv: drawing.onDownPrv, onMovePrv: drawing.onMovePrv, onUp: drawing.onUp,
    onPointerLeavePrv, trackCursorPrv: drawing.trackCursorPrv, clearCursorPrv: drawing.clearCursorPrv,
  });
  const drawingHandlers = drawingHandlersRef.current;

  return (
    <div style={S_ROOT}
      onDragEnter={fileDrop.onDragEnter} onDragOver={fileDrop.onDragOver} onDragLeave={fileDrop.onDragLeave} onDrop={fileDrop.onDrop}>
      <div ref={ariaLiveRef} role="status" aria-live="polite" aria-atomic="true" style={S_SR_ONLY} />

      {toast && <Toast message={toast.message} type={toast.type} />}

      <NewCanvasModal open={showNewCanvas} onConfirm={handleNewCanvasConfirm} onCancel={handleNewCanvasCancel} />
      <PromptModal open={!!promptState} title={t("prompt_custom_filename")} defaultValue={promptState?.defaultValue ?? ""} onConfirm={handlePromptConfirm} onCancel={handlePromptCancel} />

      {fileDrop.dragging && <div style={S_DROP_OVERLAY}>
        <div style={S_DROP_TEXT}>{t("drop_image")}</div>
      </div>}

      <HelpModal showHelp={showHelp} setShowHelp={setShowHelp} helpRef={helpRef} />

      <div style={S_HEADER}>
        <h1 style={S_TITLE}>CHROMALUM</h1>
        <div style={S_STATUS}>
          {cvs.w}&times;{cvs.h} | {Math.round(panZoom.zoom * 100)}% |{" "}
          <span style={S_HELP_LINK} onClick={() => setShowHelp(true)}>?{t("help_link")}</span>
          {" | "}<LanguageSwitcher />
        </div>
      </div>

      <div role="tablist" aria-label={t("tablist_label")} style={S_TABLIST}>
        {TAB_KEYS.map((key, i) =>
          <button key={key} role="tab" aria-selected={activeTab === i} aria-controls={`tabpanel-${i}`}
            onClick={() => setActiveTab(i)} style={activeTab === i ? S_TAB_ACTIVE : S_TAB_INACTIVE}>{t(key)}</button>)}
      </div>

      <div style={S_TAB_CENTER}>
        {activeTab === 0 && <div id="tabpanel-0" role="tabpanel">
          <SourcePanel
            srcRef={drawing.srcRef} curRef={drawing.curRef} srcWrapRef={srcWrapRef} statusRef={drawing.statusRef}
            toolState={toolState} viewState={viewState} saveActions={saveActionsObj}
            colorLUT={colorLUT} state={state}
            onDown={drawing.onDown} onMove={drawing.onMove} onUp={drawing.onUp} onPointerLeave={onPointerLeave}
            undo={undo} redo={redo} handleClear={handleClear} loadImg={fileDrop.loadImg}
            announce={announce} schedCursor={schedCursorFn} prvRef={prvRef}
            onNewCanvas={handleNewCanvas}
            requestFilename={requestFilename}
          />
        </div>}
        {activeTab === 1 && <div id="tabpanel-1" role="tabpanel">
          <ColorPanel
            prvRef={prvRef} prvCurRef={drawing.prvCurRef} prvWrapRef={prvWrapRef}
            displayW={displayW} displayH={displayH}
            canvasTransform={canvasTransform} canvasCursor={canvasCursor}
            cc={cc} ccDispatch={ccDispatch} brushLevel={brushLevel} setBrushLevel={setBrushLevel} tool={tool}
            panZoom={panZoomHandlers} drawing={drawingHandlers}
          />
        </div>}
        {activeTab === 2 && <div id="tabpanel-2" role="tabpanel">
          <HexTab
            hexPrvRef={hexPrvRef} displayW={displayW} displayH={displayH}
            cc={cc} ccDispatch={ccDispatch} hist={hist} total={cvs.w * cvs.h}
            locked={locked} toggleLock={toggleLock}
            handleRandomize={handleRandomize} handleUnlockAll={handleUnlockAll}
            patternInfo={patternInfo} t={t}
          />
        </div>}
        {activeTab === 3 && <div id="tabpanel-3" role="tabpanel">
          <GlazePanel
            prvRef={glazePrvRef} prvWrapRef={glazeWrapRef}
            displayW={displayW} displayH={displayH}
            canvasTransform={canvasTransform} canvasCursor={panZoom.cursorMode === "grabbing" ? "grabbing" : panZoom.cursorMode === "grab" ? "grab" : glazeTool === "glaze_fill" ? "crosshair" : "none"}
            cvs={cvs} dispatch={dispatch}
            panZoom={panZoomHandlers} glazeDrawing={glazeDrawing}
            hueAngle={hueAngle} setHueAngle={setHueAngle}
            glazeTool={glazeTool} setGlazeTool={setGlazeTool}
            brushSize={brushSize} setBrushSize={setBrushSize}
            announce={announce} showToast={showToast}
            undo={undo} redo={redo} zoom={panZoom.zoom}
            directCandidates={directCandidates} setDirectCandidates={setDirectCandidates}
          />
        </div>}
        <div id="tabpanel-4" role="tabpanel" style={{ display: activeTab === 4 ? undefined : "none" }}>
          <AnalyzePanel hist={hist} total={cvs.w * cvs.h} colorLUT={colorLUT} cc={cc}
            brushLevel={brushLevel} setBrushLevel={setBrushLevel} cvs={cvs}
            displayW={displayW} displayH={displayH}
            mapMode={mapMode} setMapMode={setMapMode} />
        </div>
        <div id="tabpanel-5" role="tabpanel" style={{ width: "100%", display: activeTab === 5 ? undefined : "none" }}>
          <GalleryPanel cvs={cvs} cc={cc} ccDispatch={ccDispatch}
            locked={locked} hist={hist} showToast={showToast} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { t } = useTranslation();
  const app = useAppState(t);
  const { cvs, displayW, displayH } = app;

  const ariaLiveRef = useRef<HTMLDivElement | null>(null);

  const announce = useCallback((msg: string) => {
    if (ariaLiveRef.current) ariaLiveRef.current.textContent = msg;
  }, []);

  const sharedSchedCursorRef = useRef<(() => void) | null>(null);

  const panZoom = usePanZoom(cvs, displayW, sharedSchedCursorRef);

  return (
    <DrawingContextProvider
      zoom={panZoom.zoom} pan={panZoom.pan}
      panningRef={panZoom.panningRef} spaceRef={panZoom.spaceRef}
      zoomRef={panZoom.zoomRef} panRef={panZoom.panRef}
      startPan={panZoom.startPan} movePan={panZoom.movePan} endPan={panZoom.endPan}
      displayW={displayW} displayH={displayH}
      announce={announce} t={t}
    >
      <AppContent app={app} panZoom={panZoom} announce={announce} ariaLiveRef={ariaLiveRef} t={t} />
    </DrawingContextProvider>
  );
}
