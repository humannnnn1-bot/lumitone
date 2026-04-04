import React, { useRef, useCallback, useMemo, useState } from "react";

import { isShapeTool } from "./constants";
import { LUMA_R, LUMA_G, LUMA_B, GRAY_LUT } from "./color-engine";
import { useSyncRef } from "./hooks/useSyncRef";
import { usePanZoom } from "./hooks/usePanZoom";
import { useCanvasDrawing } from "./hooks/useCanvasDrawing";
import { useGlazeDrawing } from "./hooks/useGlazeDrawing";
import { useCanvasCoordination } from "./hooks/useCanvasCoordination";
import { useStablePanZoomHandlers, useStableDrawingHandlers } from "./hooks/useStableHandlers";
import { useFileDrop } from "./hooks/useFileDrop";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useExport } from "./hooks/useExport";
import { useAppState } from "./hooks/useAppState";
import { DrawingContextProvider } from "./contexts/DrawingContext";
import { GlazeContextProvider } from "./contexts/GlazeContext";
import { S_TAB_ACTIVE, S_TAB_INACTIVE } from "./styles";
import { C, Z, FS, FW, FONT } from "./tokens";
import { Toast } from "./components/Toast";
import { SourcePanel } from "./components/SourcePanel";
import { ColorPanel } from "./components/ColorPanel";
import { GlazePanel } from "./components/GlazePanel";
import { HelpModal } from "./components/HelpModal";
import { NewCanvasModal } from "./components/NewCanvasModal";
import { CropModal } from "./components/CropModal";
import { PromptModal } from "./components/PromptModal";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { AnalyzePanel } from "./components/AnalyzePanel";
import { GalleryPanel } from "./components/GalleryPanel";
import { HexTab } from "./components/HexTab";
import { TheoryPanel } from "./components/TheoryPanel";
import { MusicPanel } from "./components/MusicPanel";
import { useTranslation } from "./i18n";

const APP_VERSION = "5.3.2";

/* ═══════════════════════════════════════════
   LAYOUT STYLE CONSTANTS
   ═══════════════════════════════════════════ */
const TAB_KEYS = ["tab_source", "tab_color", "tab_hex", "tab_glaze", "tab_stats", "tab_gallery", "tab_theory", "tab_music"] as const;

const S_ROOT: React.CSSProperties = { minHeight: "100vh", background: C.bgRoot, color: C.textPrimary, fontFamily: FONT.mono };
const S_HEADER: React.CSSProperties = { textAlign: "center", marginBottom: "var(--sp-header-mb)" };
const S_TITLE: React.CSSProperties = {
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 22,
  fontWeight: FW.normal,
  margin: "2px 0 var(--sp-title-mb)",
  color: C.textPrimary,
  letterSpacing: 10,
};
const S_STATUS: React.CSSProperties = { fontSize: FS.sm, color: C.textFaint, marginTop: 2 };
const S_HELP_LINK: React.CSSProperties = { cursor: "pointer", color: C.textDimmest, textDecoration: "underline" };
const S_TABLIST: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 0,
  marginBottom: "var(--sp-tablist-mb)",
  width: "100%",
};
const S_TAB_CENTER: React.CSSProperties = { display: "flex", justifyContent: "center", width: "100%" };
const S_DROP_OVERLAY: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: C.bgDrop,
  border: `3px dashed ${C.accent}`,
  zIndex: Z.dropOverlay,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
};
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
    state,
    dispatch,
    cvs,
    cc,
    ccDispatch,
    brushLevel,
    setBrushLevel,
    brushSize,
    setBrushSize,
    tool,
    setTool,
    activeTab,
    setActiveTab,
    showHelp,
    setShowHelp,
    toast,
    showToast,
    showNewCanvas,
    setShowNewCanvas,
    locked,
    mapMode,
    setMapMode,
    hueAngle,
    setHueAngle,
    glazeTool,
    setGlazeTool,
    directCandidates,
    setDirectCandidates,
    promptState,
    colorLUT,
    displayW,
    displayH,
    toggleLock,
    handleRandomize,
    handleUnlockAll,
    canRandomize,
    patternInfo,
    requestFilename,
    handlePromptConfirm,
    handlePromptCancel,
  } = app;

  const hist = state.hist;
  const [scrollToGallery, setScrollToGallery] = useState(false);

  const prvRef = useRef<HTMLCanvasElement | null>(null);
  const glazePrvRef = useRef<HTMLCanvasElement | null>(null);
  const hexPrvRef = useRef<HTMLCanvasElement | null>(null);
  const srcWrapRef = useRef<HTMLDivElement | null>(null);
  const prvWrapRef = useRef<HTMLDivElement | null>(null);
  const glazeWrapRef = useRef<HTMLDivElement | null>(null);
  const helpRef = useRef<HTMLDivElement | null>(null);

  const drawing = useCanvasDrawing({
    cvs,
    dispatch,
    colorLUT,
    cc,
    brushLevel,
    brushSize,
    tool,
    prvRef,
    setBrushLevel,
  });

  const glazeDrawing = useGlazeDrawing({
    cvs,
    dispatch,
    colorLUT,
    hueAngle,
    setHueAngle,
    glazeTool,
    brushSize,
    prvRef: glazePrvRef,
    directCandidates,
  });

  const { sharedSchedCursorRef } = useCanvasCoordination({
    cvs,
    colorLUT,
    activeTab,
    drawing,
    glazeDrawing,
    srcWrapRef,
    prvWrapRef,
    glazeWrapRef,
    prvRef,
    hexPrvRef,
    glazePrvRef,
    onWheel: panZoom.onWheel,
  });

  const brushSizeRef = useSyncRef(brushSize);

  // Crop modal state
  const [cropImage, setCropImage] = useState<{ img: HTMLImageElement; w: number; h: number } | null>(null);
  const handleCropRequest = useCallback((img: HTMLImageElement, w: number, h: number) => {
    setCropImage({ img, w, h });
  }, []);
  const handleCropConfirm = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const ci = cropImage;
      if (!ci) return;
      const tc = document.createElement("canvas");
      tc.width = w;
      tc.height = h;
      const ctx = tc.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(ci.img, x, y, w, h, 0, 0, w, h);
      const id = ctx.getImageData(0, 0, w, h);
      const nd = new Uint8Array(w * h);
      const px = id.data;
      for (let i = 0; i < w * h; i++) {
        const off = i * 4;
        const gray = Math.min(255, Math.round(LUMA_R * px[off] + LUMA_G * px[off + 1] + LUMA_B * px[off + 2]));
        nd[i] = GRAY_LUT[gray];
      }
      dispatch({ type: "load_image", w, h, data: nd });
      panZoom.setZoom(1);
      panZoom.setPan({ x: 0, y: 0 });
      setCropImage(null);
    },
    [cropImage, dispatch, panZoom],
  );
  const handleCropCancel = useCallback(() => setCropImage(null), []);

  const fileDrop = useFileDrop(dispatch, panZoom.setZoom, panZoom.setPan, showToast, announce, t, handleCropRequest);

  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);

  const { saveColor, saveGlaze } = useExport(cvs, colorLUT, showToast, t);

  const handleKbSave = useCallback(() => {
    saveColor(prvRef, `chromalum_color_${Date.now()}.png`);
  }, [saveColor, prvRef]);

  const handleKbSaveAs = useCallback(() => {
    requestFilename(`chromalum_color_${Date.now()}`).then((name) => {
      if (name) saveColor(prvRef, name.endsWith(".png") ? name : name + ".png");
    });
  }, [saveColor, prvRef, requestFilename]);

  useKeyboardShortcuts({
    setTool,
    setBrushLevel,
    setBrushSize,
    dispatch,
    announce,
    endPan: panZoom.endPan,
    setShowHelp,
    setCursorMode: panZoom.setCursorMode,
    spaceRef: panZoom.spaceRef,
    panningRef: panZoom.panningRef,
    brushSizeRef,
    setShowNewCanvas,
    t,
    setZoom: panZoom.setZoom,
    onSave: handleKbSave,
    onSaveAs: handleKbSaveAs,
  });

  const handleClear = useCallback(() => {
    if (hist[0] !== cvs.w * cvs.h) {
      dispatch({ type: "clear" });
    }
  }, [hist, cvs.w, cvs.h, dispatch]);

  const canvasTransform = useMemo(
    () => ({
      imageRendering: "pixelated" as const,
      transform: `scale(${panZoom.zoom}) translate(${(panZoom.pan.x * displayW) / cvs.w}px,${(panZoom.pan.y * displayH) / cvs.h}px)`,
      transformOrigin: "center center",
    }),
    [panZoom.zoom, panZoom.pan.x, panZoom.pan.y, displayW, displayH, cvs.w, cvs.h],
  );

  const canvasCursor =
    panZoom.cursorMode === "grabbing"
      ? "grabbing"
      : panZoom.cursorMode === "grab"
        ? "grab"
        : tool === "fill"
          ? "crosshair"
          : isShapeTool(tool)
            ? "crosshair"
            : "none";

  const onPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      const el = drawing.srcRef.current;
      if (el && drawing.drawingRef.current) {
        try {
          if (typeof el.hasPointerCapture === "function" && el.hasPointerCapture(e.pointerId)) {
            drawing.clearCursor();
            return;
          }
        } catch (err) {
          console.warn("CHROMALUM: pointerCapture check failed:", err);
        }
      }
      drawing.onUp();
      drawing.clearCursor();
    },
    [drawing],
  );

  const onPointerLeavePrv = useCallback(
    (e: React.PointerEvent) => {
      const el = prvRef.current;
      if (el && drawing.drawingRef.current) {
        try {
          if (typeof el.hasPointerCapture === "function" && el.hasPointerCapture(e.pointerId)) {
            drawing.clearCursorPrv();
            return;
          }
        } catch (err) {
          console.warn("CHROMALUM: pointerCapture check failed:", err);
        }
      }
      drawing.onUp();
      drawing.clearCursorPrv();
    },
    [drawing],
  );

  const schedCursorFn = useCallback(() => {
    drawing.schedCursorRef.current?.();
  }, [drawing.schedCursorRef]);

  const toolState = useMemo(
    () => ({
      tool,
      setTool,
      brushLevel,
      setBrushLevel,
      brushSize,
      setBrushSize,
    }),
    [tool, setTool, brushLevel, setBrushLevel, brushSize, setBrushSize],
  );

  const viewState = useMemo(
    () => ({
      zoom: panZoom.zoom,
      setZoom: panZoom.setZoom,
      setPan: panZoom.setPan,
      displayW,
      displayH,
      canvasTransform,
      canvasCursor,
    }),
    [panZoom.zoom, panZoom.setZoom, panZoom.setPan, displayW, displayH, canvasTransform, canvasCursor],
  );

  const saveActionsObj = useMemo(
    () => ({
      saveColor,
      saveGlaze,
    }),
    [saveColor, saveGlaze],
  );

  const handleNewCanvas = useCallback(() => setShowNewCanvas(true), [setShowNewCanvas]);
  const handleNewCanvasConfirm = useCallback(
    (w: number, h: number) => {
      dispatch({ type: "new_canvas", w, h });
      panZoom.setZoom(1);
      panZoom.setPan({ x: 0, y: 0 });
      setShowNewCanvas(false);
      showToast(t("toast_new_canvas_created", w, h), "success");
    },
    [state.undoStack.length, panZoom.setZoom, panZoom.setPan, dispatch, setShowNewCanvas, showToast, t],
  );
  const handleNewCanvasCancel = useCallback(() => setShowNewCanvas(false), [setShowNewCanvas]);

  // Stable handler objects: use refs to avoid recreating on every render
  const panZoomHandlers = useStablePanZoomHandlers({
    setZoom: panZoom.setZoom,
    setPan: panZoom.setPan,
    schedCursorRef: sharedSchedCursorRef,
    spaceRef: panZoom.spaceRef,
    panningRef: panZoom.panningRef,
    startPan: panZoom.startPan,
    movePan: panZoom.movePan,
    endPan: panZoom.endPan,
  });
  const drawingHandlers = useStableDrawingHandlers({
    onDownPrv: drawing.onDownPrv,
    onMovePrv: drawing.onMovePrv,
    onUp: drawing.onUp,
    onPointerLeavePrv,
    trackCursorPrv: drawing.trackCursorPrv,
    clearCursorPrv: drawing.clearCursorPrv,
  });

  return (
    <div
      style={S_ROOT}
      onDragEnter={fileDrop.onDragEnter}
      onDragOver={fileDrop.onDragOver}
      onDragLeave={fileDrop.onDragLeave}
      onDrop={fileDrop.onDrop}
    >
      <div ref={ariaLiveRef} role="status" aria-live="polite" aria-atomic="true" style={S_SR_ONLY} />

      {toast && <Toast message={toast.message} type={toast.type} />}

      <NewCanvasModal open={showNewCanvas} onConfirm={handleNewCanvasConfirm} onCancel={handleNewCanvasCancel} />
      {cropImage && (
        <CropModal img={cropImage.img} imgW={cropImage.w} imgH={cropImage.h} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}
      <PromptModal
        open={!!promptState}
        title={t("prompt_custom_filename")}
        defaultValue={promptState?.defaultValue ?? ""}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
      />

      {fileDrop.dragging && (
        <div style={S_DROP_OVERLAY}>
          <div style={S_DROP_TEXT}>{t("drop_image")}</div>
        </div>
      )}

      <HelpModal showHelp={showHelp} setShowHelp={setShowHelp} helpRef={helpRef} />

      <div style={S_HEADER}>
        <h1 style={S_TITLE}>CHROMALUM</h1>
        <div style={S_STATUS}>
          {cvs.w}&times;{cvs.h} |{" "}
          <span style={S_HELP_LINK} onClick={() => setShowHelp(true)}>
            {t("help_link")}
          </span>
          {" | "}
          <LanguageSwitcher />
          {" | "}
          <span style={{ opacity: 0.8 }}>v{APP_VERSION}</span>
        </div>
      </div>

      <div role="tablist" aria-label={t("tablist_label")} style={S_TABLIST}>
        {TAB_KEYS.map((key, i) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === i}
            aria-controls={`tabpanel-${i}`}
            onClick={() => setActiveTab(i)}
            style={activeTab === i ? S_TAB_ACTIVE : S_TAB_INACTIVE}
          >
            {t(key)}
          </button>
        ))}
      </div>

      <div style={S_TAB_CENTER}>
        {activeTab === 0 && (
          <div id="tabpanel-0" role="tabpanel">
            <SourcePanel
              srcRef={drawing.srcRef}
              curRef={drawing.curRef}
              srcWrapRef={srcWrapRef}
              statusRef={drawing.statusRef}
              toolState={toolState}
              viewState={viewState}
              saveActions={saveActionsObj}
              colorLUT={colorLUT}
              state={state}
              onDown={drawing.onDown}
              onMove={drawing.onMove}
              onUp={drawing.onUp}
              onPointerLeave={onPointerLeave}
              undo={undo}
              redo={redo}
              handleClear={handleClear}
              loadImg={fileDrop.loadImg}
              announce={announce}
              schedCursor={schedCursorFn}
              prvRef={prvRef}
              onNewCanvas={handleNewCanvas}
              requestFilename={requestFilename}
              panZoomMode={panZoom.panZoomMode}
              setPanZoomMode={panZoom.setPanZoomMode}
              onPinchDown={panZoom.onPinchDown}
              onPinchMove={panZoom.onPinchMove}
              onPinchUp={panZoom.onPinchUp}
            />
          </div>
        )}
        {activeTab === 1 && (
          <div id="tabpanel-1" role="tabpanel">
            <ColorPanel
              prvRef={prvRef}
              prvCurRef={drawing.prvCurRef}
              prvWrapRef={prvWrapRef}
              displayW={displayW}
              displayH={displayH}
              canvasTransform={canvasTransform}
              canvasCursor={canvasCursor}
              cc={cc}
              ccDispatch={ccDispatch}
              brushLevel={brushLevel}
              setBrushLevel={setBrushLevel}
              tool={tool}
              panZoom={panZoomHandlers}
              drawing={drawingHandlers}
            />
          </div>
        )}
        {activeTab === 2 && (
          <div id="tabpanel-2" role="tabpanel">
            <HexTab
              hexPrvRef={hexPrvRef}
              displayW={displayW}
              displayH={displayH}
              cc={cc}
              ccDispatch={ccDispatch}
              hist={hist}
              total={cvs.w * cvs.h}
              locked={locked}
              toggleLock={toggleLock}
              handleRandomize={handleRandomize}
              handleUnlockAll={handleUnlockAll}
              canRandomize={canRandomize}
              patternInfo={patternInfo}
              t={t}
              onPatternClick={() => {
                setScrollToGallery(true);
                setActiveTab(5);
              }}
            />
          </div>
        )}
        {activeTab === 3 && (
          <div id="tabpanel-3" role="tabpanel">
            <GlazeContextProvider
              hueAngle={hueAngle}
              setHueAngle={setHueAngle}
              glazeTool={glazeTool}
              setGlazeTool={setGlazeTool}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              directCandidates={directCandidates}
              setDirectCandidates={setDirectCandidates}
            >
              <GlazePanel
                prvRef={glazePrvRef}
                prvWrapRef={glazeWrapRef}
                displayW={displayW}
                displayH={displayH}
                canvasTransform={canvasTransform}
                canvasCursor={
                  panZoom.cursorMode === "grabbing"
                    ? "grabbing"
                    : panZoom.cursorMode === "grab"
                      ? "grab"
                      : glazeTool === "glaze_fill"
                        ? "crosshair"
                        : "none"
                }
                cvs={cvs}
                dispatch={dispatch}
                panZoom={panZoomHandlers}
                glazeDrawing={glazeDrawing}
                announce={announce}
                showToast={showToast}
                undo={undo}
                redo={redo}
                zoom={panZoom.zoom}
                brushLevel={brushLevel}
                panZoomMode={panZoom.panZoomMode}
                setPanZoomMode={panZoom.setPanZoomMode}
                onPinchDown={panZoom.onPinchDown}
                onPinchMove={panZoom.onPinchMove}
                onPinchUp={panZoom.onPinchUp}
              />
            </GlazeContextProvider>
          </div>
        )}
        <div id="tabpanel-4" role="tabpanel" style={{ display: activeTab === 4 ? undefined : "none" }}>
          <AnalyzePanel
            hist={hist}
            total={cvs.w * cvs.h}
            colorLUT={colorLUT}
            cc={cc}
            brushLevel={brushLevel}
            setBrushLevel={setBrushLevel}
            cvs={cvs}
            displayW={displayW}
            displayH={displayH}
            mapMode={mapMode}
            setMapMode={setMapMode}
          />
        </div>
        <div id="tabpanel-5" role="tabpanel" style={{ width: "100%", display: activeTab === 5 ? undefined : "none" }}>
          <GalleryPanel
            cvs={cvs}
            cc={cc}
            ccDispatch={ccDispatch}
            locked={locked}
            hist={hist}
            showToast={showToast}
            active={activeTab === 5}
            scrollToCurrent={scrollToGallery}
            onScrollDone={() => setScrollToGallery(false)}
          />
        </div>
        <div id="tabpanel-6" role="tabpanel" style={{ width: "100%", display: activeTab === 6 ? undefined : "none" }}>
          <TheoryPanel />
        </div>
        {activeTab === 7 && (
          <div id="tabpanel-7" role="tabpanel" style={{ width: "100%" }}>
            <MusicPanel />
          </div>
        )}
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
      zoom={panZoom.zoom}
      pan={panZoom.pan}
      panningRef={panZoom.panningRef}
      spaceRef={panZoom.spaceRef}
      zoomRef={panZoom.zoomRef}
      panRef={panZoom.panRef}
      startPan={panZoom.startPan}
      movePan={panZoom.movePan}
      endPan={panZoom.endPan}
      displayW={displayW}
      displayH={displayH}
      announce={announce}
      t={t}
    >
      <AppContent app={app} panZoom={panZoom} announce={announce} ariaLiveRef={ariaLiveRef} t={t} />
    </DrawingContextProvider>
  );
}
