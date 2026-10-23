import { useEffect, useMemo, useRef, useState } from 'react';
import type { Station, ViewMode } from '../data/types';
import { useI18n } from '../i18n';
import type { Theme } from '../themes/night';
import { GlobeRenderer, type AnchorProjection } from './globeRenderer';

export interface GlobeCanvasProps {
  stations: Station[];
  theme: Theme;
  mode: ViewMode;
  selectedId: string | null;
  hoveredId: string | null;
  matchIds: Set<string> | null;
  focusStation: Station | null;
  onHover: (station: Station | null, x: number, y: number) => void;
  onSelect: (station: Station | null) => void;
  onPlay: (station: Station) => void;
}

export function GlobeCanvas(props: GlobeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GlobeRenderer | null>(null);
  const propsRef = useRef(props);
  const [error, setError] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<AnchorProjection[]>([]);
  const { lang } = useI18n();
  propsRef.current = props;

  const callbacks = useMemo(
    () => ({
      onHover: (station: Station | null, x: number, y: number) =>
        propsRef.current.onHover(station, x, y),
      onSelect: (station: Station | null) => propsRef.current.onSelect(station),
      onPlay: (station: Station) => propsRef.current.onPlay(station),
      onAnchors: (next: AnchorProjection[]) => setAnchors(next),
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const renderer = new GlobeRenderer(canvas, propsRef.current.stations, propsRef.current.theme, callbacks);
      rendererRef.current = renderer;
      renderer.setMode(propsRef.current.mode);
      renderer.setSelected(propsRef.current.selectedId);
      renderer.setHovered(propsRef.current.hoveredId);
      renderer.setMatchIds(propsRef.current.matchIds);
      if (propsRef.current.focusStation) renderer.focusStation(propsRef.current.focusStation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WebGL is not available');
    }
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [callbacks]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setStations(props.stations);
    renderer.setSelected(props.selectedId);
    renderer.setMatchIds(props.matchIds);
    renderer.setMode(props.mode);
    if (props.focusStation) renderer.focusStation(props.focusStation);
  }, [props.stations]);

  useEffect(() => {
    rendererRef.current?.setTheme(props.theme);
  }, [props.theme]);

  useEffect(() => {
    rendererRef.current?.setMode(props.mode);
  }, [props.mode]);

  useEffect(() => {
    rendererRef.current?.setSelected(props.selectedId);
  }, [props.selectedId]);

  useEffect(() => {
    rendererRef.current?.setHovered(props.hoveredId);
  }, [props.hoveredId]);

  useEffect(() => {
    rendererRef.current?.setMatchIds(props.matchIds);
  }, [props.matchIds]);

  useEffect(() => {
    if (props.focusStation) rendererRef.current?.focusStation(props.focusStation);
  }, [props.focusStation]);

  if (error) {
    return (
      <div className="globe-fallback">
        <p>这个浏览器没有开启 WebGL，暂时画不出地球。</p>
        <p className="dim">你仍然可以用搜索和列表收听电台。</p>
        <span className="mono">{error}</span>
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="globe-canvas" aria-hidden="true" />
      <div className="map-labels" aria-hidden="true">
        {anchors.map((anchor) => (
          <span
            key={anchor.id}
            className={`map-label ${anchor.kind} align-${anchor.align}`}
            style={{
              left: anchor.x,
              top: anchor.y,
              opacity: anchor.front * (anchor.kind === 'continent' ? 0.74 : 0.96),
            }}
          >
            {anchor.kind === 'city' && <i />}
            {lang === 'zh' ? anchor.zh : anchor.en}
          </span>
        ))}
      </div>
    </>
  );
}
