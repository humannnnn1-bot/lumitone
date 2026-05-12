import React, { Suspense, lazy, useEffect, useRef, useCallback, useMemo, useState } from "react";

import { isShapeTool } from "./constants";
import { useSyncRef } from "./hooks/useSyncRef";
import { usePanZoom } from "./hooks/usePanZoom";
import { useCanvasDrawing } from "./hooks/useCanvasDrawing";
import { useGlazeDrawing } from "./hooks/useGlazeDrawing";
import { useCanvasCoordination } from "./hooks/useCanvasCoordination";
import { useStablePanZoomHandlers, useStableDrawingHandlers } from "./hooks/useStableHandlers";
import { useFileDrop } from "./hooks/useFileDrop";
import { useImageImportCrop } from "./hooks/useImageImportCrop";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useExport } from "./hooks/useExport";
import { useAppState } from "./hooks/useAppState";
import { usePwaUpdate } from "./hooks/usePwaUpdate";
import { DrawingContextProvider } from "./state/DrawingContext";
import { GlazeContextProvider } from "./state/GlazeContext";
import { C, Z, FS, FW, FONT } from "./styles/tokens";
import { Toast } from "./components/Toast";
import { PwaUpdateToast } from "./components/PwaUpdateToast";
import { getTabButtonId, getTabPanelId, tabFromId } from "./tabs";
import { AppTabBar } from "./components/AppTabBar";
import { SourcePanel } from "./components/SourcePanel";
import { ColorPanel } from "./components/ColorPanel";
import { GlazePanel } from "./components/GlazePanel";
import { AboutModal } from "./components/AboutModal";
import { HelpModal } from "./components/HelpModal";
import { NewCanvasModal } from "./components/NewCanvasModal";
import { CropModal } from "./components/CropModal";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { AnalyzePanel } from "./components/AnalyzePanel";
import { GalleryPanel } from "./components/GalleryPanel";
import { HexPanel } from "./components/HexPanel";
import { TheoryPanel } from "./components/TheoryPanel";
import { useTranslation } from "./i18n";

const MusicPanel = lazy(async () => {
  const mod = await import("./components/MusicPanel");
  return { default: mod.MusicPanel };
});

/* ═══════════════════════════════════════════
   LAYOUT STYLE CONSTANTS
   ═══════════════════════════════════════════ */
const S_ROOT: React.CSSProperties = { minHeight: "100vh", background: C.bgRoot, color: C.textPrimary, fontFamily: FONT.sans };
const S_HEADER: React.CSSProperties = { textAlign: "center", marginBottom: "var(--sp-header-mb)" };
const S_TITLE: React.CSSProperties = {
  fontFamily: FONT.sans,
  fontSize: 22,
  fontWeight: FW.normal,
  margin: "2px 0 var(--sp-title-mb)",
  color: C.textPrimary,
  letterSpacing: 10,
};
const S_STATUS: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontSize: FS.sm,
  color: C.textFaint,
  marginTop: "var(--sp-status-mt)",
};
const S_HEADER_ACTION: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: C.textDim,
  cursor: "pointer",
  font: "inherit",
  textDecoration: "underline",
  textDecorationColor: C.textSubtle,
  textUnderlineOffset: 1,
  transition: "color 0.1s, text-decoration-color 0.1s",
};
const S_HEADER_SEPARATOR: React.CSSProperties = { color: C.textSubtle };
const S_HEADER_LANGUAGE_SEPARATOR: React.CSSProperties = { color: C.textSubtle, marginLeft: 4, marginRight: 4 };
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
const S_LAZY_PANEL_FALLBACK: React.CSSProperties = {
  width: "100%",
  minHeight: 240,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: C.textMuted,
  fontSize: FS.lg,
};
interface AppContentProps {
  app: ReturnType<typeof useAppState>;
  panZoom: ReturnType<typeof usePanZoom>;
  sharedSchedCursorRef: React.MutableRefObject<(() => void) | null>;
  announce: (msg: string) => void;
  ariaLiveRef: React.MutableRefObject<HTMLDivElement | null>;
  t: import("./i18n").TranslationFn;
}

function AppContent({ app, panZoom, sharedSchedCursorRef, announce, ariaLiveRef, t }: AppContentProps) {
  const {
    state,
    dispatch,
    canvasData,
    candidateIndexByLevel,
    candidateIndexDispatch,
    brushLevel,
    setBrushLevel,
    brushSize,
    setBrushSize,
    tool,
    setTool,
    activeTabId,
    setActiveTabId,
    hasOpenedStats,
    showHelp,
    setShowHelp,
    toast,
    showToast,
    showNewCanvas,
    setShowNewCanvas,
    lockedLevels,
    mapMode,
    setMapMode,
    hueAngle,
    setHueAngle,
    glazeTool,
    setGlazeTool,
    candidateOverridesByLevel,
    setCandidateOverridesByLevel,
    colorLUT,
    displayW,
    displayH,
    toggleLevelLock,
    handleRandomize,
    handleUnlockAll,
    canRandomize,
    patternInfo,
  } = app;

  const levelHistogram = state.levelHistogram;
  const [scrollToGallery, setScrollToGallery] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const pwaUpdate = usePwaUpdate();

  useEffect(() => {
    document.title = `CHROMALUM - ${t(tabFromId(activeTabId).key)}`;
  }, [activeTabId, t]);

  const prvRef = useRef<HTMLCanvasElement | null>(null);
  const glazePrvRef = useRef<HTMLCanvasElement | null>(null);
  const hexPrvRef = useRef<HTMLCanvasElement | null>(null);
  const srcWrapRef = useRef<HTMLDivElement | null>(null);
  const prvWrapRef = useRef<HTMLDivElement | null>(null);
  const glazeWrapRef = useRef<HTMLDivElement | null>(null);
  const helpRef = useRef<HTMLDivElement | null>(null);

  const drawing = useCanvasDrawing({
    canvasData,
    dispatch,
    colorLUT,
    candidateIndexByLevel,
    brushLevel,
    brushSize,
    tool,
    prvRef,
    setBrushLevel,
  });

  const glazeDrawing = useGlazeDrawing({
    canvasData,
    dispatch,
    colorLUT,
    candidateIndexByLevel,
    hueAngle,
    setHueAngle,
    glazeTool,
    brushSize,
    prvRef: glazePrvRef,
    candidateOverridesByLevel,
  });

  useCanvasCoordination({
    canvasData,
    colorLUT,
    activeTabId,
    drawing,
    glazeDrawing,
    srcWrapRef,
    prvWrapRef,
    glazeWrapRef,
    prvRef,
    hexPrvRef,
    glazePrvRef,
    sharedSchedCursorRef,
    onWheel: panZoom.onWheel,
  });

  const brushSizeRef = useSyncRef(brushSize);

  const { cropImage, handleCropRequest, handleCropConfirm, handleCropCancel } = useImageImportCrop({
    dispatch,
    setZoom: panZoom.setZoom,
    setPan: panZoom.setPan,
  });

  const fileDrop = useFileDrop(dispatch, panZoom.setZoom, panZoom.setPan, showToast, announce, t, handleCropRequest);

  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);

  const { saveColor, saveColorWithLUT, saveGlaze, shareColor, shareGlaze } = useExport(canvasData, colorLUT, showToast, t);

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
    activeTabId,
  });

  const handleClear = useCallback(() => {
    if (levelHistogram[0] !== canvasData.width * canvasData.height) {
      dispatch({ type: "clear" });
    }
  }, [levelHistogram, canvasData.width, canvasData.height, dispatch]);

  const canvasTransform = useMemo(
    () => ({
      imageRendering: "pixelated" as const,
      transform: `scale(${panZoom.zoom}) translate(${(panZoom.pan.x * displayW) / canvasData.width}px,${(panZoom.pan.y * displayH) / canvasData.height}px)`,
      transformOrigin: "center center",
    }),
    [panZoom.zoom, panZoom.pan.x, panZoom.pan.y, displayW, displayH, canvasData.width, canvasData.height],
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
      saveColorWithLUT,
      saveGlaze,
      shareColor,
      shareGlaze,
    }),
    [saveColor, saveColorWithLUT, saveGlaze, shareColor, shareGlaze],
  );

  const { setZoom, setPan } = panZoom;

  const handleNewCanvas = useCallback(() => setShowNewCanvas(true), [setShowNewCanvas]);
  const handleNewCanvasConfirm = useCallback(
    (w: number, h: number) => {
      dispatch({ type: "new_canvas", width: w, height: h });
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setShowNewCanvas(false);
      showToast(t("toast_new_canvas_created", w, h), "success");
    },
    [setZoom, setPan, dispatch, setShowNewCanvas, showToast, t],
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
    handleMiddleDown: panZoom.handleMiddleDown,
    movePan: panZoom.movePan,
    endPan: panZoom.endPan,
  });
  const drawingHandlers = useStableDrawingHandlers({
    onDownPrv: drawing.onWorkspaceDownPrv,
    onMovePrv: drawing.onWorkspaceMovePrv,
    onUp: drawing.onUp,
    onPointerLeavePrv: drawing.onWorkspaceLeavePrv,
    trackCursorPrv: drawing.trackCursorPrv,
    clearCursorPrv: drawing.clearCursorPrv,
  });

  return (
    <main
      style={S_ROOT}
      onDragEnter={fileDrop.onDragEnter}
      onDragOver={fileDrop.onDragOver}
      onDragLeave={fileDrop.onDragLeave}
      onDrop={fileDrop.onDrop}
    >
      <div ref={ariaLiveRef} role="status" aria-live="polite" aria-atomic="true" style={S_SR_ONLY} />

      {toast && <Toast message={toast.message} type={toast.type} />}
      {pwaUpdate.hasUpdate && (
        <PwaUpdateToast reloading={pwaUpdate.reloading} onReload={pwaUpdate.reload} onDismiss={pwaUpdate.dismiss} t={t} />
      )}

      <NewCanvasModal open={showNewCanvas} onConfirm={handleNewCanvasConfirm} onCancel={handleNewCanvasCancel} />
      {cropImage && (
        <CropModal img={cropImage.img} imgW={cropImage.w} imgH={cropImage.h} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}
      {fileDrop.dragging && (
        <div style={S_DROP_OVERLAY}>
          <div style={S_DROP_TEXT}>{t("drop_image")}</div>
        </div>
      )}

      <AboutModal open={showAbout} onClose={() => setShowAbout(false)} />
      <HelpModal showHelp={showHelp} setShowHelp={setShowHelp} helpRef={helpRef} />

      <div style={S_HEADER}>
        <h1 style={S_TITLE}>CHROMALUM</h1>
        <div style={S_STATUS}>
          <button type="button" className="header-action-link" style={S_HEADER_ACTION} onClick={() => setShowAbout(true)}>
            {t("header_about")}
          </button>
          <span style={S_HEADER_SEPARATOR}>·</span>
          <button type="button" className="header-action-link" style={S_HEADER_ACTION} onClick={() => setShowHelp(true)}>
            {t("header_shortcuts")}
          </button>
          <span style={S_HEADER_LANGUAGE_SEPARATOR}>|</span>
          <LanguageSwitcher />
        </div>
      </div>

      <AppTabBar activeTabId={activeTabId} onTabChange={setActiveTabId} t={t} />

      <div style={S_TAB_CENTER}>
        {activeTabId === "source" && (
          <div id={getTabPanelId("source")} role="tabpanel" aria-labelledby={getTabButtonId("source")}>
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
              onDown={drawing.onWorkspaceDown}
              onMove={drawing.onWorkspaceMove}
              onUp={drawing.onUp}
              onPointerLeave={drawing.onWorkspaceLeave}
              clearCursor={drawing.clearCursor}
              undo={undo}
              redo={redo}
              handleClear={handleClear}
              loadImg={fileDrop.loadImg}
              announce={announce}
              schedCursor={schedCursorFn}
              prvRef={prvRef}
              onNewCanvas={handleNewCanvas}
              panZoomMode={panZoom.panZoomMode}
              setPanZoomMode={panZoom.setPanZoomMode}
              handleMiddleDown={panZoom.handleMiddleDown}
              onPinchDown={panZoom.onPinchDown}
              onPinchMove={panZoom.onPinchMove}
              onPinchUp={panZoom.onPinchUp}
            />
          </div>
        )}
        {activeTabId === "color" && (
          <div id={getTabPanelId("color")} role="tabpanel" aria-labelledby={getTabButtonId("color")}>
            <ColorPanel
              prvRef={prvRef}
              prvCurRef={drawing.prvCurRef}
              prvWrapRef={prvWrapRef}
              statusRef={drawing.statusRef}
              displayW={displayW}
              displayH={displayH}
              canvasTransform={canvasTransform}
              canvasCursor={canvasCursor}
              candidateIndexByLevel={candidateIndexByLevel}
              candidateIndexDispatch={candidateIndexDispatch}
              brushLevel={brushLevel}
              setBrushLevel={setBrushLevel}
              tool={tool}
              panZoom={panZoomHandlers}
              drawing={drawingHandlers}
            />
          </div>
        )}
        {activeTabId === "hex" && (
          <div id={getTabPanelId("hex")} role="tabpanel" aria-labelledby={getTabButtonId("hex")}>
            <HexPanel
              hexPrvRef={hexPrvRef}
              canvasData={canvasData}
              displayW={displayW}
              displayH={displayH}
              candidateIndexByLevel={candidateIndexByLevel}
              candidateIndexDispatch={candidateIndexDispatch}
              levelHistogram={levelHistogram}
              total={canvasData.width * canvasData.height}
              lockedLevels={lockedLevels}
              toggleLevelLock={toggleLevelLock}
              handleRandomize={handleRandomize}
              handleUnlockAll={handleUnlockAll}
              canRandomize={canRandomize}
              patternInfo={patternInfo}
              t={t}
              onPatternClick={() => {
                setScrollToGallery(true);
                setActiveTabId("gallery");
              }}
            />
          </div>
        )}
        {activeTabId === "glaze" && (
          <div id={getTabPanelId("glaze")} role="tabpanel" aria-labelledby={getTabButtonId("glaze")}>
            <GlazeContextProvider
              hueAngle={hueAngle}
              setHueAngle={setHueAngle}
              glazeTool={glazeTool}
              setGlazeTool={setGlazeTool}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              candidateOverridesByLevel={candidateOverridesByLevel}
              setCandidateOverridesByLevel={setCandidateOverridesByLevel}
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
                canvasData={canvasData}
                dispatch={dispatch}
                panZoom={panZoomHandlers}
                glazeDrawing={glazeDrawing}
                announce={announce}
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
        {(activeTabId === "stats" || hasOpenedStats) && (
          <div
            id={getTabPanelId("stats")}
            role="tabpanel"
            aria-labelledby={getTabButtonId("stats")}
            style={{ display: activeTabId === "stats" ? undefined : "none" }}
          >
            <AnalyzePanel
              levelHistogram={levelHistogram}
              total={canvasData.width * canvasData.height}
              colorLUT={colorLUT}
              candidateIndexByLevel={candidateIndexByLevel}
              brushLevel={brushLevel}
              setBrushLevel={setBrushLevel}
              canvasData={canvasData}
              displayW={displayW}
              displayH={displayH}
              active={activeTabId === "stats"}
              mapMode={mapMode}
              setMapMode={setMapMode}
              showToast={showToast}
            />
          </div>
        )}
        <div
          id={getTabPanelId("gallery")}
          role="tabpanel"
          aria-labelledby={getTabButtonId("gallery")}
          style={{ width: "100%", display: activeTabId === "gallery" ? undefined : "none" }}
        >
          <GalleryPanel
            canvasData={canvasData}
            candidateIndexByLevel={candidateIndexByLevel}
            candidateIndexDispatch={candidateIndexDispatch}
            lockedLevels={lockedLevels}
            levelHistogram={levelHistogram}
            showToast={showToast}
            saveColorWithLUT={saveColorWithLUT}
            active={activeTabId === "gallery"}
            scrollToCurrent={scrollToGallery}
            onScrollDone={() => setScrollToGallery(false)}
          />
        </div>
        <div
          id={getTabPanelId("theory")}
          role="tabpanel"
          aria-labelledby={getTabButtonId("theory")}
          style={{ width: "100%", display: activeTabId === "theory" ? undefined : "none" }}
        >
          <TheoryPanel />
        </div>
        {activeTabId === "music" && (
          <div id={getTabPanelId("music")} role="tabpanel" aria-labelledby={getTabButtonId("music")} style={{ width: "100%" }}>
            <Suspense fallback={<div style={S_LAZY_PANEL_FALLBACK}>Loading...</div>}>
              <MusicPanel />
            </Suspense>
          </div>
        )}
      </div>
    </main>
  );
}

export default function App() {
  const { t } = useTranslation();
  const app = useAppState(t);
  const { canvasData, displayW, displayH } = app;

  const ariaLiveRef = useRef<HTMLDivElement | null>(null);

  const announce = useCallback((msg: string) => {
    if (ariaLiveRef.current) ariaLiveRef.current.textContent = msg;
  }, []);

  const sharedSchedCursorRef = useRef<(() => void) | null>(null);

  const panZoom = usePanZoom(canvasData, displayW, sharedSchedCursorRef);

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
      <AppContent
        app={app}
        panZoom={panZoom}
        sharedSchedCursorRef={sharedSchedCursorRef}
        announce={announce}
        ariaLiveRef={ariaLiveRef}
        t={t}
      />
    </DrawingContextProvider>
  );
}
