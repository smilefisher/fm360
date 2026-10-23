import { feature } from 'topojson-client';
import { MAP_ANCHORS } from '../data/anchors';
import { GENRE_IDS, genreColor } from '../data/genres';
import type { Station, ViewMode } from '../data/types';
import { hexToRgb, type Theme } from '../themes/night';

type Vec3 = [number, number, number];

export interface AnchorProjection {
  id: string;
  kind: 'continent' | 'city';
  zh: string;
  en: string;
  x: number;
  y: number;
  front: number;
  align: 'left' | 'right';
}

export interface GlobeCallbacks {
  onHover?: (station: Station | null, x: number, y: number) => void;
  onSelect?: (station: Station | null) => void;
  onPlay?: (station: Station) => void;
  onAnchors?: (anchors: AnchorProjection[]) => void;
}

const DEG = Math.PI / 180;

function rad(deg: number): number {
  return deg * DEG;
}

function latLngToVec3(lat: number, lng: number): Vec3 {
  const la = rad(lat);
  const lo = rad(lng);
  const cos = Math.cos(la);
  return [cos * Math.sin(lo), Math.sin(la), cos * Math.cos(lo)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wrapAngle(value: number): number {
  let a = value;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** R = Rx(pitch) * Ry(yaw), returned column-major for WebGL. */
function rotationMatrix(yaw: number, pitch: number): Float32Array {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return new Float32Array([
    cy, sp * sy, -cp * sy,
    0, cp, sp,
    sy, -sp * cy, cp * cy,
  ]);
}

function transposeMat3(m: Float32Array): Float32Array {
  return new Float32Array([
    m[0], m[3], m[6],
    m[1], m[4], m[7],
    m[2], m[5], m[8],
  ]);
}

function multiplyMat3Vec3(m: Float32Array, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
}

function sunDirection(date: Date): Vec3 {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86_400_000;
  const decl = -23.44 * Math.cos((Math.PI * 2 * (day + 10)) / 365);
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const subLng = (12 - utcHours) * 15;
  return latLngToVec3(decl, subLng);
}

function terminatorBuffer(sun: Vec3): Float32Array {
  const [sx, sy, sz] = sun;
  // u = normalize(cross(sun, up))
  let ux = -sz;
  let uy = 0;
  let uz = sx;
  let len = Math.hypot(ux, uy, uz);
  if (len < 0.01) {
    ux = 1;
    uy = 0;
    uz = 0;
    len = 1;
  }
  ux /= len;
  uz /= len;
  // v = cross(sun, u)
  const vx = sy * uz - sz * uy;
  const vy = sz * ux - sx * uz;
  const vz = sx * uy - sy * ux;
  const points = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 256) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    points[i * 3] = ux * c + vx * s;
    points[i * 3 + 1] = uy * c + vy * s;
    points[i * 3 + 2] = uz * c + vz * s;
  }
  return points;
}

export interface SkyCluster {
  genre: string;
  x: number;
  y: number;
  count: number;
}

const SKY_START = -Math.PI / 2;
const SKY_RADIUS = 0.58;
const SKY_RADIUS_ALT = 0.14;

function skyCenter(index: number): { x: number; y: number } {
  const angle = SKY_START + (index / GENRE_IDS.length) * Math.PI * 2;
  const radius = SKY_RADIUS + (index % 2) * SKY_RADIUS_ALT;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function skyClusterCenters(stations: Station[] = []): SkyCluster[] {
  const counts = new Map<string, number>();
  for (const station of stations) {
    counts.set(station.genre, (counts.get(station.genre) ?? 0) + 1);
  }
  return GENRE_IDS.map((genre, index) => ({
    genre,
    ...skyCenter(index),
    count: counts.get(genre) ?? 0,
  }));
}

interface SkyLayout {
  positions: Float32Array;
  lines: Float32Array;
}

function skyLayout(stations: Station[]): SkyLayout {
  const positions = new Float32Array(stations.length * 3);
  const counts = new Map<string, number>();
  for (const s of stations) counts.set(s.genre, (counts.get(s.genre) ?? 0) + 1);
  const seen = new Map<string, number>();
  const centers = skyClusterCenters(stations);
  const centerById = new Map(
    centers.map((center, i) => [center.genre, { ...center, i }] as const),
  );
  const groups = new Map<string, number[]>();

  stations.forEach((station, index) => {
    const center =
      centerById.get(station.genre) ?? centerById.get('mixed') ?? centerById.get('pop')!;
    const n = counts.get(station.genre) ?? 1;
    const j = seen.get(station.genre) ?? 0;
    seen.set(station.genre, j + 1);
    const angle = j * 2.399963 + center.i * 0.71;
    const r = 0.018 + 0.112 * Math.sqrt((j + 0.5) / n);
    const x = center.x + Math.cos(angle) * r;
    const y = center.y + Math.sin(angle) * r;
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = 0;
    const group = groups.get(station.genre);
    if (group) group.push(index);
    else groups.set(station.genre, [index]);
  });

  const lines: number[] = [];
  for (const [genre, indices] of groups) {
    const center = centerById.get(genre);
    if (!center || indices.length < 3) continue;
    const sorted = [...indices].sort((a, b) => {
      const aa = Math.atan2(positions[a * 3 + 1] - center.y, positions[a * 3] - center.x);
      const bb = Math.atan2(positions[b * 3 + 1] - center.y, positions[b * 3] - center.x);
      return aa - bb;
    });
    const rgb = hexToRgb(genreColor(genre));
    for (let k = 1; k < sorted.length; k++) {
      const a = sorted[k - 1];
      const b = sorted[k];
      const ax = positions[a * 3];
      const ay = positions[a * 3 + 1];
      const bx = positions[b * 3];
      const by = positions[b * 3 + 1];
      if (Math.hypot(ax - bx, ay - by) > 0.24) continue;
      lines.push(ax, ay, 0, rgb[0], rgb[1], rgb[2], bx, by, 0, rgb[0], rgb[1], rgb[2]);
    }
  }

  return { positions, lines: new Float32Array(lines) };
}

function ringsFromGeo(geo: any): number[][][] {
  if (!geo) return [];
  if (geo.type === 'FeatureCollection') {
    return (geo.features ?? []).flatMap((f: any) => ringsFromGeo(f.geometry));
  }
  if (geo.type === 'Feature') return ringsFromGeo(geo.geometry);
  if (geo.type === 'MultiPolygon') {
    return (geo.coordinates ?? []).flatMap((poly: any) => poly);
  }
  if (geo.type === 'Polygon') return geo.coordinates ?? [];
  return [];
}

function buildLandSegments(topology: any): Float32Array {
  let geo: any;
  try {
    geo = feature(topology, topology.objects.land);
  } catch {
    return new Float32Array(0);
  }
  const rings = ringsFromGeo(geo);
  const out: number[] = [];
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      const [lng1, lat1] = ring[i - 1];
      const [lng2, lat2] = ring[i];
      if (Math.abs(lng1 - lng2) > 180) continue;
      const a = latLngToVec3(lat1, lng1);
      const b = latLngToVec3(lat2, lng2);
      out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }
  return new Float32Array(out);
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function makeProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create program');
  const vs = compile(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }
  return program;
}

const DISC_VS = `
attribute vec2 a_pos;
varying vec2 v_clip;
void main() {
  v_clip = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const DISC_FS = `
precision highp float;
varying vec2 v_clip;
uniform vec2 u_radiusClip;
uniform vec3 u_sunView;
uniform vec3 u_oceanDay;
uniform vec3 u_oceanNight;
uniform vec3 u_rim;
uniform float u_opacity;
uniform sampler2D u_map;
uniform float u_mapReady;
uniform mat3 u_invRot;
uniform vec3 u_mapLandDay;
uniform vec3 u_mapLandNight;
uniform vec3 u_mapBorder;
uniform vec3 u_mapGrid;
uniform float u_time;

void main() {
  vec2 p = v_clip / u_radiusClip;
  float r2 = dot(p, p);
  if (r2 > 1.0) {
    float halo = exp(-(sqrt(r2) - 1.0) * 13.0) * 0.19;
    gl_FragColor = vec4(u_rim, halo * u_opacity);
    return;
  }
  vec3 n = vec3(p, sqrt(max(0.0, 1.0 - r2)));
  float day = dot(n, u_sunView);
  float light = smoothstep(-0.18, 0.34, day);
  vec3 col = mix(u_oceanNight, u_oceanDay, light);
  float band = exp(-pow(day / 0.075, 2.0));
  col += u_rim * band * 0.17;
  float rim = pow(1.0 - n.z, 2.7);
  float breathe = 0.92 + 0.08 * sin(u_time * 0.55);
  col += u_rim * rim * 0.66 * breathe;
  col += u_oceanDay * 0.04 * sin(p.y * 9.0 + p.x * 2.0);

  if (u_mapReady > 0.5) {
    vec3 earthN = u_invRot * n;
    float lat = asin(clamp(earthN.y, -1.0, 1.0));
    float lng = atan(earthN.x, earthN.z);
    vec2 uv = vec2(lng * 0.15915494 + 0.5, lat * 0.31830989 + 0.5);
    vec4 map = texture2D(u_map, uv);
    float land = map.r;
    float border = map.g;
    float grid = map.b;
    float landMask = max(land, border * 0.92);
    vec3 landCol = mix(u_mapLandNight, u_mapLandDay, light);
    col = mix(col, landCol, landMask * 0.94);
    col = mix(col, u_mapBorder * (0.65 + 0.45 * light), border * 0.55);
    col += u_mapGrid * grid * 0.10;
  }

  float sunSpot = pow(max(0.0, dot(n, u_sunView)), 14.0);
  col += u_rim * sunSpot * 0.10 * (0.85 + 0.15 * sin(u_time * 0.8));
  gl_FragColor = vec4(col, u_opacity);
}
`;

const STATION_VS = `
attribute vec3 a_geo;
attribute vec3 a_sky;
attribute vec3 a_color;
attribute float a_size;
attribute float a_health;
attribute float a_match;
attribute float a_index;

uniform mat3 u_rot;
uniform vec3 u_sun;
uniform vec2 u_proj;
uniform float u_mix;
uniform float u_pointScale;
uniform float u_selected;
uniform float u_hover;
uniform float u_pixelRatio;
uniform float u_time;

varying vec3 v_color;
varying float v_alpha;
varying float v_night;
varying float v_selected;
varying float v_hover;

void main() {
  vec3 globe = u_rot * a_geo;
  vec3 sky = a_sky;
  vec3 p = mix(globe, sky, u_mix);

  float front = smoothstep(-0.10, 0.10, globe.z);
  float night = smoothstep(-0.22, 0.34, -dot(normalize(a_geo), u_sun));
  float visible = mix(front, 1.0, u_mix);
  float sel = step(abs(a_index - u_selected), 0.5);
  float hov = step(abs(a_index - u_hover), 0.5);

  float phase = fract(a_index * 0.61803398875) * 6.2831853;
  float twinkle = 0.88 + 0.12 * sin(u_time * 0.85 + phase);
  float size = a_size * (0.55 + 0.45 * a_health) * twinkle;
  size *= u_pointScale * mix(0.82 + 0.32 * night, 1.22, u_mix);
  size *= mix(0.56, 1.0, a_match);
  size += (sel * 9.0 + hov * 4.0) * u_pixelRatio;

  gl_PointSize = min(size, 72.0);
  gl_Position = vec4(p.xy * u_proj, 0.0, 1.0);
  v_color = a_color;
  v_alpha = visible * mix(0.28, 1.0, a_match) * (0.92 + 0.08 * twinkle);
  v_night = mix(night, 0.55, u_mix);
  v_selected = sel;
  v_hover = hov;
}
`;

const STATION_FS = `
precision highp float;
varying vec3 v_color;
varying float v_alpha;
varying float v_night;
varying float v_selected;
varying float v_hover;
uniform float u_time;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float glow = pow(1.0 - d, 1.5);
  float core = smoothstep(0.52, 0.0, d);
  vec3 col = v_color * (0.82 + 0.62 * v_night);
  float alpha = v_alpha * (0.18 + 0.88 * glow);
  if (v_selected > 0.5) {
    float pulse = 0.5 + 0.5 * sin(u_time * 2.4);
    float ring = smoothstep(0.15, 0.0, abs(d - (0.68 + 0.05 * pulse)));
    col = mix(col, vec3(0.96, 0.94, 0.90), ring);
    alpha = max(alpha, ring * (0.62 + 0.35 * pulse));
  } else if (v_hover > 0.5) {
    float ring = smoothstep(0.12, 0.0, abs(d - 0.64));
    alpha = max(alpha, ring * 0.55);
  }
  gl_FragColor = vec4(col * (0.90 + 0.65 * core), alpha);
}
`;

const LINE_VS = `
attribute vec3 a_pos;
uniform mat3 u_rot;
uniform vec3 u_sun;
uniform vec2 u_proj;
uniform float u_opacity;
uniform float u_mix;
varying float v_night;
varying float v_alpha;
void main() {
  vec3 p = u_rot * a_pos;
  float front = smoothstep(-0.12, 0.06, p.z);
  float night = smoothstep(-0.22, 0.34, -dot(normalize(a_pos), u_sun));
  gl_Position = vec4(p.xy * u_proj, 0.0, 1.0);
  v_night = night;
  v_alpha = front * u_opacity * (1.0 - u_mix);
}
`;

const LINE_FS = `
precision highp float;
varying float v_night;
varying float v_alpha;
uniform vec3 u_dayColor;
uniform vec3 u_nightColor;
void main() {
  vec3 col = mix(u_dayColor, u_nightColor, v_night);
  gl_FragColor = vec4(col, v_alpha);
}
`;

const SPRITE_VS = `
attribute vec3 a_pos;
attribute float a_size;
attribute float a_phase;
uniform mat3 u_rot;
uniform vec2 u_proj;
uniform float u_useRot;
uniform float u_pointScale;
uniform float u_time;
uniform float u_twinkle;
varying float v_alpha;
void main() {
  vec3 p = a_pos;
  float front = 1.0;
  if (u_useRot > 0.5) {
    p = u_rot * a_pos;
    front = smoothstep(-0.10, 0.10, p.z);
  }
  gl_Position = vec4(p.xy * u_proj, 0.0, 1.0);
  gl_PointSize = max(1.0, a_size * u_pointScale);
  float tw = mix(1.0, 0.72 + 0.28 * sin(u_time * 0.9 + a_phase), u_twinkle);
  v_alpha = front * tw;
}
`;

const SPRITE_FS = `
precision highp float;
uniform vec3 u_color;
uniform float u_alpha;
varying float v_alpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float glow = pow(1.0 - d, 1.8);
  gl_FragColor = vec4(u_color, u_alpha * v_alpha * glow);
}
`;

const SKY_LINE_VS = `
attribute vec3 a_pos;
attribute vec3 a_color;
uniform vec2 u_proj;
varying vec3 v_color;
void main() {
  v_color = a_color;
  gl_Position = vec4(a_pos.xy * u_proj, 0.0, 1.0);
}
`;

const SKY_LINE_FS = `
precision highp float;
varying vec3 v_color;
uniform float u_alpha;
void main() {
  gl_FragColor = vec4(v_color, u_alpha);
}
`;

interface Buffers {
  station: WebGLBuffer | null;
  skyLine: WebGLBuffer | null;
  land: WebGLBuffer | null;
  terminator: WebGLBuffer | null;
  stars: WebGLBuffer | null;
  quad: WebGLBuffer | null;
}

export class GlobeRenderer {
  private canvas: HTMLCanvasElement;
  private callbacks: GlobeCallbacks;
  private gl: WebGLRenderingContext;
  private theme: Theme;
  private stations: Station[] = [];
  private indexById = new Map<string, number>();

  private discProgram: WebGLProgram;
  private stationProgram: WebGLProgram;
  private lineProgram: WebGLProgram;
  private spriteProgram: WebGLProgram;
  private skyLineProgram: WebGLProgram;

  private buffers: Buffers = {
    station: null,
    skyLine: null,
    land: null,
    terminator: null,
    stars: null,
    quad: null,
  };

  private stationCount = 0;
  private match: Float32Array = new Float32Array(0);
  private starPhase: Float32Array = new Float32Array(0);
  private starSize: Float32Array = new Float32Array(0);

  private yaw = rad(-10);
  private pitch = rad(20);
  private zoom = 0.9;
  private targetZoom = 1;
  private velocityYaw = 0;
  private velocityPitch = 0;
  private lastMoveAt = 0;
  private mix = 0;
  private targetMix = 0;
  private selectedIndex = -1;
  private hoveredIndex = -1;

  private focusTarget: { yaw: number; pitch: number } | null = null;
  private dragging = false;
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  private lastInteraction = 0;
  private lastClickAt = 0;
  private lastClickIndex = -1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart = 0;
  private pinchZoom = 1;

  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private radiusPx = 1;
  private width = 1;
  private height = 1;

  private sun: Vec3 = sunDirection(new Date());
  private lastSunUpdate = 0;
  private lastAnchorsUpdate = 0;
  private anchorsVisible = true;
  private startTime = performance.now();
  private lastFrame = performance.now();
  private raf = 0;
  private destroyed = false;
  private reducedMotion = false;
  private landLoaded = false;
  private mapTexture: WebGLTexture | null = null;
  private fallbackTexture: WebGLTexture | null = null;
  private mapReady = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, stations: Station[], theme: Theme, callbacks: GlobeCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.theme = theme;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;

    this.discProgram = makeProgram(gl, DISC_VS, DISC_FS);
    this.stationProgram = makeProgram(gl, STATION_VS, STATION_FS);
    this.lineProgram = makeProgram(gl, LINE_VS, LINE_FS);
    this.spriteProgram = makeProgram(gl, SPRITE_VS, SPRITE_FS);
    this.skyLineProgram = makeProgram(gl, SKY_LINE_VS, SKY_LINE_FS);

    this.buffers.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    this.stars();
    this.initFallbackTexture();
    this.loadMapTexture();
    this.setStations(stations);
    this.updateTerminator();
    this.resize();
    this.bindEvents();

    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (this.reducedMotion) {
      this.mix = this.targetMix;
      this.zoom = 1;
      this.targetZoom = 1;
      this.radiusPx = Math.min(this.cssW, this.cssH) * 0.42;
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    this.loadLand();
    this.loop(performance.now());
  }

  private stars(): void {
    const gl = this.gl;
    const rand = mulberry32(360);
    const count = 760;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() * 2 - 1) * 1.45;
      positions[i * 3 + 1] = (rand() * 2 - 1) * 1.05;
      positions[i * 3 + 2] = 0;
      const bright = rand();
      sizes[i] = 0.55 + bright * bright * 2.1;
      phases[i] = rand() * Math.PI * 2;
    }
    this.starSize = sizes;
    this.starPhase = phases;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    this.buffers.stars = buffer;
    // Store star attributes in one interleaved buffer: pos(3) + size(1) + phase(1).
    const interleaved = new Float32Array(count * 5);
    for (let i = 0; i < count; i++) {
      interleaved[i * 5] = positions[i * 3];
      interleaved[i * 5 + 1] = positions[i * 3 + 1];
      interleaved[i * 5 + 2] = positions[i * 3 + 2];
      interleaved[i * 5 + 3] = sizes[i];
      interleaved[i * 5 + 4] = phases[i];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
    this.starBufferInterleaved = buffer;
    this.starBufferCount = count;
  }

  private starBufferCount = 0;

  private loadLand(): void {
    fetch('/land-110m.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((topology) => {
        if (!topology || this.destroyed) return;
        const positions = buildLandSegments(topology);
        if (!positions.length) return;
        const gl = this.gl;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        if (this.buffers.land) gl.deleteBuffer(this.buffers.land);
        this.buffers.land = buffer;
        this.landLoaded = true;
        this.landVertexCount = positions.length / 3;
      })
      .catch(() => {
        // The globe still works without land outlines.
      });
  }

  private landVertexCount = 0;

  private initFallbackTexture(): void {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.fallbackTexture = texture;
  }

  private loadMapTexture(): void {
    const gl = this.gl;
    const image = new Image();
    image.onload = () => {
      if (this.destroyed) return;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.mapTexture = texture;
      this.mapReady = true;
    };
    image.onerror = () => {
      // The ocean/land-line fallback still works without the texture.
      this.mapReady = false;
    };
    image.src = '/world-map.png';
  }

  setStations(stations: Station[]): void {
    this.stations = stations;
    this.stationCount = stations.length;
    this.indexById.clear();
    stations.forEach((s, i) => this.indexById.set(s.id, i));

    const geo = new Float32Array(stations.length * 3);
    const colors = new Float32Array(stations.length * 3);
    const sizes = new Float32Array(stations.length);
    const health = new Float32Array(stations.length);
    const index = new Float32Array(stations.length);
    this.match = new Float32Array(stations.length).fill(1);

    stations.forEach((s, i) => {
      const p = latLngToVec3(s.lat, s.lng);
      geo[i * 3] = p[0];
      geo[i * 3 + 1] = p[1];
      geo[i * 3 + 2] = p[2];
      const rgb = hexToRgb(genreColor(s.genre));
      colors[i * 3] = rgb[0];
      colors[i * 3 + 1] = rgb[1];
      colors[i * 3 + 2] = rgb[2];
      const bitrate = s.bitrate > 0 ? Math.min(1, s.bitrate / 256) : 0.35;
      const popularity = Math.min(1, Math.log1p(Math.max(0, s.pop)) / 9);
      sizes[i] = 0.85 + bitrate * 0.7 + popularity * 0.55;
      health[i] = s.health == null ? 0.72 : clamp(s.health / 100, 0.15, 1);
      index[i] = i;
    });

    const sky = skyLayout(stations);
    this.uploadStationBuffers(geo, sky.positions, colors, sizes, health, index);
    this.uploadSkyLines(sky.lines);
    this.selectedIndex = -1;
    this.hoveredIndex = -1;
  }

  private skyLineCount = 0;

  private uploadSkyLines(lines: Float32Array): void {
    const gl = this.gl;
    if (this.buffers.skyLine) {
      gl.deleteBuffer(this.buffers.skyLine);
      this.buffers.skyLine = null;
    }
    if (!lines.length) {
      this.skyLineCount = 0;
      return;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, lines, gl.STATIC_DRAW);
    this.buffers.skyLine = buffer;
    this.skyLineCount = lines.length / 6;
  }

  private uploadStationBuffers(
    geo: Float32Array,
    sky: Float32Array,
    colors: Float32Array,
    sizes: Float32Array,
    health: Float32Array,
    index: Float32Array,
  ): void {
    const gl = this.gl;
    if (this.buffers.station) gl.deleteBuffer(this.buffers.station);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const n = this.stationCount;
    const data = new Float32Array(
      n * 13,
    );
    for (let i = 0; i < n; i++) {
      const o = i * 13;
      data[o] = geo[i * 3];
      data[o + 1] = geo[i * 3 + 1];
      data[o + 2] = geo[i * 3 + 2];
      data[o + 3] = sky[i * 3];
      data[o + 4] = sky[i * 3 + 1];
      data[o + 5] = sky[i * 3 + 2];
      data[o + 6] = colors[i * 3];
      data[o + 7] = colors[i * 3 + 1];
      data[o + 8] = colors[i * 3 + 2];
      data[o + 9] = sizes[i];
      data[o + 10] = health[i];
      data[o + 11] = this.match[i] ?? 1;
      data[o + 12] = index[i];
    }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    this.buffers.station = buffer;
    // Keep a copy for fast picking.
    this.geo = geo;
    this.sky = sky;
  }

  private geo: Float32Array = new Float32Array(0);
  private sky: Float32Array = new Float32Array(0);

  setTheme(theme: Theme): void {
    this.theme = theme;
    if (!this.stationCount) return;
    const gl = this.gl;
    const station = this.buffers.station;
    if (!station) return;
    // Rebuild colors in place.
    const colors = new Float32Array(this.stationCount * 3);
    this.stations.forEach((s, i) => {
      const rgb = hexToRgb(genreColor(s.genre));
      colors[i * 3] = rgb[0];
      colors[i * 3 + 1] = rgb[1];
      colors[i * 3 + 2] = rgb[2];
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, station);
    // Colors live at offset 6 floats per vertex; update each vertex individually.
    const data = new Float32Array(this.stationCount * 13);
    for (let i = 0; i < this.stationCount; i++) {
      const o = i * 13;
      data[o] = this.geo[i * 3];
      data[o + 1] = this.geo[i * 3 + 1];
      data[o + 2] = this.geo[i * 3 + 2];
      data[o + 3] = this.sky[i * 3];
      data[o + 4] = this.sky[i * 3 + 1];
      data[o + 5] = this.sky[i * 3 + 2];
      data[o + 6] = colors[i * 3];
      data[o + 7] = colors[i * 3 + 1];
      data[o + 8] = colors[i * 3 + 2];
      const s = this.stations[i];
      const bitrate = s.bitrate > 0 ? Math.min(1, s.bitrate / 256) : 0.35;
      const popularity = Math.min(1, Math.log1p(Math.max(0, s.pop)) / 9);
      data[o + 9] = 0.85 + bitrate * 0.7 + popularity * 0.55;
      data[o + 10] = s.health == null ? 0.72 : clamp(s.health / 100, 0.15, 1);
      data[o + 11] = this.match[i] ?? 1;
      data[o + 12] = i;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  }

  setMatchIds(ids: Set<string> | null): void {
    if (!this.stationCount) return;
    for (let i = 0; i < this.stationCount; i++) {
      this.match[i] = !ids || ids.has(this.stations[i].id) ? 1 : 0;
    }
    const station = this.buffers.station;
    if (!station) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, station);
    // Update the a_match float (offset 11) for every vertex.
    const data = new Float32Array(this.stationCount * 13);
    for (let i = 0; i < this.stationCount; i++) {
      const o = i * 13;
      data[o] = this.geo[i * 3];
      data[o + 1] = this.geo[i * 3 + 1];
      data[o + 2] = this.geo[i * 3 + 2];
      data[o + 3] = this.sky[i * 3];
      data[o + 4] = this.sky[i * 3 + 1];
      data[o + 5] = this.sky[i * 3 + 2];
      const s = this.stations[i];
      const rgb = hexToRgb(genreColor(s.genre));
      data[o + 6] = rgb[0];
      data[o + 7] = rgb[1];
      data[o + 8] = rgb[2];
      const bitrate = s.bitrate > 0 ? Math.min(1, s.bitrate / 256) : 0.35;
      const popularity = Math.min(1, Math.log1p(Math.max(0, s.pop)) / 9);
      data[o + 9] = 0.85 + bitrate * 0.7 + popularity * 0.55;
      data[o + 10] = s.health == null ? 0.72 : clamp(s.health / 100, 0.15, 1);
      data[o + 11] = this.match[i];
      data[o + 12] = i;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  }

  setSelected(id: string | null): void {
    this.selectedIndex = id == null ? -1 : this.indexById.get(id) ?? -1;
  }

  setHovered(id: string | null): void {
    this.hoveredIndex = id == null ? -1 : this.indexById.get(id) ?? -1;
  }

  setMode(mode: ViewMode): void {
    this.targetMix = mode === 'sky' ? 1 : 0;
    this.targetZoom = mode === 'sky' ? 1 : this.targetZoom;
    if (mode === 'sky') this.focusTarget = null;
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    this.lastInteraction = performance.now();
  }

  focusStation(station: Station): void {
    this.focusTarget = {
      yaw: -rad(station.lng),
      pitch: rad(station.lat),
    };
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    this.lastInteraction = performance.now();
  }

  resize(): void {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width || window.innerWidth);
    this.cssH = Math.max(1, rect.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.round(this.cssW * this.dpr);
    this.height = Math.round(this.cssH * this.dpr);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.gl.viewport(0, 0, this.width, this.height);
    this.radiusPx = Math.min(this.cssW, this.cssH) * 0.42 * this.zoom;
  }

  private bindEvents(): void {
    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
  };

  private onPointerDown = (event: PointerEvent): void => {
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.lastInteraction = performance.now();
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    this.lastMoveAt = this.lastInteraction;
    if (this.pointers.size === 1) {
      this.dragging = true;
      this.moved = false;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinchZoom = this.zoom;
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.pointers.has(event.pointerId)) {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    this.lastInteraction = performance.now();

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchStart > 0) {
        this.zoom = clamp((this.pinchZoom * distance) / this.pinchStart, 0.65, 2.2);
        this.targetZoom = this.zoom;
        this.radiusPx = Math.min(this.cssW, this.cssH) * 0.42 * this.zoom;
      }
      return;
    }

    if (this.dragging) {
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 1) this.moved = true;
      const now = performance.now();
      const frameDt = Math.max(8, now - this.lastMoveAt);
      this.lastMoveAt = now;
      const dyaw = dx * 0.005;
      const dpitch = dy * 0.005;
      this.yaw += dyaw;
      this.pitch = clamp(this.pitch + dpitch, -1.35, 1.35);
      const frameScale = 16.67 / frameDt;
      this.velocityYaw = this.velocityYaw * 0.55 + dyaw * frameScale * 0.45;
      this.velocityPitch = this.velocityPitch * 0.55 + dpitch * frameScale * 0.45;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.focusTarget = null;
      return;
    }

    const hit = this.pick(event.clientX, event.clientY);
    if (hit !== this.hoveredIndex) {
      this.hoveredIndex = hit;
      this.callbacks.onHover?.(hit >= 0 ? this.stations[hit] : null, event.clientX, event.clientY);
    } else if (hit >= 0) {
      this.callbacks.onHover?.(this.stations[hit], event.clientX, event.clientY);
    }
    this.canvas.style.cursor = hit >= 0 ? 'pointer' : 'grab';
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchStart = 0;
    if (this.pointers.size > 0) return;
    const wasDragging = this.dragging;
    this.dragging = false;
    if (wasDragging && performance.now() - this.lastMoveAt > 120) {
      this.velocityYaw *= 0.2;
      this.velocityPitch *= 0.2;
    }
    if (event.type === 'pointercancel' || !wasDragging || this.moved) return;
    const hit = this.pick(event.clientX, event.clientY);
    if (hit >= 0) {
      const station = this.stations[hit];
      this.callbacks.onSelect?.(station);
      const now = performance.now();
      if (this.lastClickIndex === hit && now - this.lastClickAt < 400) {
        this.callbacks.onPlay?.(station);
      }
      this.lastClickIndex = hit;
      this.lastClickAt = now;
    } else {
      this.callbacks.onSelect?.(null);
    }
  };

  private onPointerLeave = (): void => {
    this.pointers.clear();
    this.dragging = false;
    this.pinchStart = 0;
    if (this.hoveredIndex >= 0) {
      this.hoveredIndex = -1;
      this.callbacks.onHover?.(null, 0, 0);
    }
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.lastInteraction = performance.now();
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    const factor = Math.exp(-event.deltaY * 0.0012);
    this.zoom = clamp(this.zoom * factor, 0.65, 2.2);
    this.targetZoom = this.zoom;
    this.radiusPx = Math.min(this.cssW, this.cssH) * 0.42 * this.zoom;
  };

  private pick(clientX: number, clientY: number): number {
    if (!this.stationCount) return -1;
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const radius = this.radiusPx;
    const cx = this.cssW / 2;
    const cy = this.cssH / 2;
    const m = rotationMatrix(this.yaw, this.pitch);
    let best = -1;
    let bestDist = 20 * 20;
    const useSky = this.mix > 0.5;
    for (let i = 0; i < this.stationCount; i++) {
      let px: number;
      let py: number;
      if (useSky) {
        px = this.sky[i * 3];
        py = this.sky[i * 3 + 1];
      } else {
        const g = multiplyMat3Vec3(m, [
          this.geo[i * 3],
          this.geo[i * 3 + 1],
          this.geo[i * 3 + 2],
        ]);
        if (g[2] < 0.02) continue;
        px = g[0];
        py = g[1];
      }
      const sx = cx + px * radius;
      const sy = cy - py * radius;
      const dx = sx - x;
      const dy = sy - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  private loop = (time: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(48, time - this.lastFrame);
    this.lastFrame = time;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;

    if (time - this.lastSunUpdate > 60_000) {
      this.sun = sunDirection(new Date());
      this.lastSunUpdate = time;
      this.updateTerminator();
    }

    if (time - this.lastAnchorsUpdate > 50 && this.callbacks.onAnchors) {
      this.lastAnchorsUpdate = time;
      if (this.mix > 0.5) {
        if (this.anchorsVisible) {
          this.anchorsVisible = false;
          this.callbacks.onAnchors([]);
        }
      } else {
        this.anchorsVisible = true;
        const m = rotationMatrix(this.yaw, this.pitch);
        const showCities = this.zoom > 1.15;
        const anchors: AnchorProjection[] = [];
        const placed: Array<{ x: number; y: number }> = [];
        for (const anchor of MAP_ANCHORS) {
          if (anchor.kind === 'city' && !anchor.major && !showCities) continue;
          const p = multiplyMat3Vec3(m, latLngToVec3(anchor.lat, anchor.lng));
          if (p[2] <= 0.01) continue;
          const x = this.cssW / 2 + p[0] * this.radiusPx;
          const y = this.cssH / 2 - p[1] * this.radiusPx;
          const minX = anchor.kind === 'continent' ? 68 : 48;
          const minY = anchor.kind === 'continent' ? 17 : 14;
          if (placed.some((item) => Math.abs(item.x - x) < minX && Math.abs(item.y - y) < minY)) {
            continue;
          }
          placed.push({ x, y });
          anchors.push({
            id: anchor.id,
            kind: anchor.kind,
            zh: anchor.zh,
            en: anchor.en,
            x,
            y,
            front: clamp((p[2] - 0.01) / 0.16, 0, 1),
            align: x > this.cssW - 120 ? 'right' : 'left',
          });
        }
        this.callbacks.onAnchors(anchors);
      }
    }

    const ease = this.reducedMotion ? 1 : 1 - Math.pow(0.001, dt / 1000);
    if (!this.reducedMotion) {
      this.mix += (this.targetMix - this.mix) * ease;
      this.zoom += (this.targetZoom - this.zoom) * ease;
      this.radiusPx = Math.min(this.cssW, this.cssH) * 0.42 * this.zoom;
    } else {
      this.mix = this.targetMix;
      this.zoom = this.targetZoom;
      this.radiusPx = Math.min(this.cssW, this.cssH) * 0.42 * this.zoom;
    }
    if (Math.abs(this.targetMix - this.mix) < 0.002) this.mix = this.targetMix;
    if (Math.abs(this.targetZoom - this.zoom) < 0.002) this.zoom = this.targetZoom;

    const hasInertia =
      !this.dragging &&
      !this.reducedMotion &&
      (Math.abs(this.velocityYaw) > 0.00002 || Math.abs(this.velocityPitch) > 0.00002);
    if (hasInertia) {
      const frame = dt / 16.67;
      this.yaw += this.velocityYaw * frame;
      this.pitch = clamp(this.pitch + this.velocityPitch * frame, -1.35, 1.35);
      const damp = Math.pow(0.93, frame);
      this.velocityYaw *= damp;
      this.velocityPitch *= damp;
      if (Math.abs(this.velocityYaw) < 0.00002) this.velocityYaw = 0;
      if (Math.abs(this.velocityPitch) < 0.00002) this.velocityPitch = 0;
      this.lastInteraction = time;
    }

    if (this.focusTarget) {
      const dy = wrapAngle(this.focusTarget.yaw - this.yaw);
      const dp = this.focusTarget.pitch - this.pitch;
      this.yaw += dy * (this.reducedMotion ? 1 : 0.12);
      this.pitch += dp * (this.reducedMotion ? 1 : 0.12);
      if (Math.abs(dy) < 0.002 && Math.abs(dp) < 0.002) this.focusTarget = null;
    } else if (
      !this.reducedMotion &&
      !this.dragging &&
      this.hoveredIndex < 0 &&
      this.mix < 0.5 &&
      time - this.lastInteraction > 3000
    ) {
      this.yaw += 0.00022 * (dt / 16.67);
    }

    this.render(time);
  };

  private updateTerminator(): void {
    const gl = this.gl;
    if (this.buffers.terminator) gl.deleteBuffer(this.buffers.terminator);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, terminatorBuffer(this.sun), gl.DYNAMIC_DRAW);
    this.buffers.terminator = buffer;
  }

  private render(time: number): void {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // Vertex attribute state is global in WebGL. Buffers can be replaced by
    // setStations(), so clear all enabled arrays at the start of each frame to
    // avoid pointing at a deleted buffer.
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);

    const radiusClip: [number, number] = [
      (this.radiusPx * 2) / this.cssW,
      (this.radiusPx * 2) / this.cssH,
    ];
    const proj: [number, number] = radiusClip;
    const m = rotationMatrix(this.yaw, this.pitch);
    const sunView = multiplyMat3Vec3(m, this.sun);
    const theme = this.theme.webgl;

    // Stars (behind everything).
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.spriteProgram);
    this.bindSpriteAttributes(this.starBufferInterleaved);
    gl.uniformMatrix3fv(
      gl.getUniformLocation(this.spriteProgram, 'u_rot'),
      false,
      m,
    );
    gl.uniform2f(gl.getUniformLocation(this.spriteProgram, 'u_proj'), 1, 1);
    gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_useRot'), 0);
    gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_pointScale'), 1.0 * this.dpr);
    gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_time'), time / 1000);
    gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_twinkle'), this.reducedMotion ? 0 : 1);
    gl.uniform3f(gl.getUniformLocation(this.spriteProgram, 'u_color'), theme.star[0], theme.star[1], theme.star[2]);
    gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_alpha'), 0.8);
    gl.drawArrays(gl.POINTS, 0, this.starBufferCount);

    // Globe disc.
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (this.mix < 0.995) {
      gl.useProgram(this.discProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
      const loc = gl.getAttribLocation(this.discProgram, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(this.discProgram, 'u_radiusClip'), radiusClip[0], radiusClip[1]);
      gl.uniform3f(gl.getUniformLocation(this.discProgram, 'u_sunView'), sunView[0], sunView[1], sunView[2]);
      gl.uniform3f(gl.getUniformLocation(this.discProgram, 'u_oceanDay'), theme.oceanDay[0], theme.oceanDay[1], theme.oceanDay[2]);
      gl.uniform3f(gl.getUniformLocation(this.discProgram, 'u_oceanNight'), theme.oceanNight[0], theme.oceanNight[1], theme.oceanNight[2]);
      gl.uniform3f(gl.getUniformLocation(this.discProgram, 'u_rim'), theme.landNight[0], theme.landNight[1], theme.landNight[2]);
      gl.uniform1f(gl.getUniformLocation(this.discProgram, 'u_opacity'), 1 - this.mix);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(
        gl.TEXTURE_2D,
        this.mapReady ? this.mapTexture : this.fallbackTexture,
      );
      gl.uniform1i(gl.getUniformLocation(this.discProgram, 'u_map'), 0);
      gl.uniform1f(gl.getUniformLocation(this.discProgram, 'u_mapReady'), this.mapReady ? 1 : 0);
      gl.uniformMatrix3fv(
        gl.getUniformLocation(this.discProgram, 'u_invRot'),
        false,
        transposeMat3(m),
      );
      gl.uniform3f(gl.getUniformLocation(this.discProgram, 'u_mapLandDay'), theme.mapLandDay[0], theme.mapLandDay[1], theme.mapLandDay[2]);
      gl.uniform3f(gl.getUniformLocation(this.discProgram, 'u_mapLandNight'), theme.mapLandNight[0], theme.mapLandNight[1], theme.mapLandNight[2]);
      gl.uniform3f(gl.getUniformLocation(this.discProgram, 'u_mapBorder'), theme.mapBorderDay[0], theme.mapBorderDay[1], theme.mapBorderDay[2]);
      gl.uniform3f(gl.getUniformLocation(this.discProgram, 'u_mapGrid'), theme.mapGrid[0], theme.mapGrid[1], theme.mapGrid[2]);
      gl.uniform1f(
        gl.getUniformLocation(this.discProgram, 'u_time'),
        this.reducedMotion ? 0 : time / 1000,
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(loc);
    }

    // Land outlines.
    if (this.landLoaded && this.mix < 0.995) {
      gl.useProgram(this.lineProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.land);
      const loc = gl.getAttribLocation(this.lineProgram, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix3fv(gl.getUniformLocation(this.lineProgram, 'u_rot'), false, m);
      gl.uniform3f(gl.getUniformLocation(this.lineProgram, 'u_sun'), this.sun[0], this.sun[1], this.sun[2]);
      gl.uniform2f(gl.getUniformLocation(this.lineProgram, 'u_proj'), proj[0], proj[1]);
      gl.uniform3f(gl.getUniformLocation(this.lineProgram, 'u_dayColor'), theme.landDay[0], theme.landDay[1], theme.landDay[2]);
      gl.uniform3f(gl.getUniformLocation(this.lineProgram, 'u_nightColor'), theme.landNight[0], theme.landNight[1], theme.landNight[2]);
      gl.uniform1f(
        gl.getUniformLocation(this.lineProgram, 'u_opacity'),
        this.mapReady ? 0.18 : 0.52,
      );
      gl.uniform1f(gl.getUniformLocation(this.lineProgram, 'u_mix'), this.mix);
      gl.drawArrays(gl.LINES, 0, this.landVertexCount);
      gl.disableVertexAttribArray(loc);
    }

    // Terminator glow.
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    if (this.buffers.terminator && this.mix < 0.995) {
      gl.useProgram(this.spriteProgram);
      this.bindTerminatorAttributes(m);
      gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_useRot'), 1);
      gl.uniform2f(gl.getUniformLocation(this.spriteProgram, 'u_proj'), proj[0], proj[1]);
      gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_time'), time / 1000);
      gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_twinkle'), 0);
      gl.uniform3f(gl.getUniformLocation(this.spriteProgram, 'u_color'), theme.terminator[0], theme.terminator[1], theme.terminator[2]);
      const termPulse = this.reducedMotion ? 1 : 0.9 + 0.1 * Math.sin(time / 1600);
      gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_pointScale'), 3.8 * this.dpr);
      gl.uniform1f(
        gl.getUniformLocation(this.spriteProgram, 'u_alpha'),
        0.13 * (1 - this.mix) * termPulse,
      );
      gl.drawArrays(gl.POINTS, 0, 256);
      gl.uniform1f(gl.getUniformLocation(this.spriteProgram, 'u_pointScale'), 1.7 * this.dpr);
      gl.uniform1f(
        gl.getUniformLocation(this.spriteProgram, 'u_alpha'),
        0.55 * (1 - this.mix) * termPulse,
      );
      gl.drawArrays(gl.POINTS, 0, 256);
    }

    // Faint constellation webs in sky mode.
    if (this.buffers.skyLine && this.skyLineCount > 0 && this.mix > 0.002) {
      gl.useProgram(this.skyLineProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.skyLine);
      const stride = 6 * 4;
      const pos = gl.getAttribLocation(this.skyLineProgram, 'a_pos');
      const color = gl.getAttribLocation(this.skyLineProgram, 'a_color');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(color);
      gl.vertexAttribPointer(color, 3, gl.FLOAT, false, stride, 3 * 4);
      gl.uniform2f(gl.getUniformLocation(this.skyLineProgram, 'u_proj'), proj[0], proj[1]);
      gl.uniform1f(gl.getUniformLocation(this.skyLineProgram, 'u_alpha'), this.mix * 0.22);
      gl.drawArrays(gl.LINES, 0, this.skyLineCount);
      gl.disableVertexAttribArray(pos);
      gl.disableVertexAttribArray(color);
    }

    // Stations.
    gl.useProgram(this.stationProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.station);
    this.bindStationAttributes();
    gl.uniformMatrix3fv(gl.getUniformLocation(this.stationProgram, 'u_rot'), false, m);
    gl.uniform3f(gl.getUniformLocation(this.stationProgram, 'u_sun'), this.sun[0], this.sun[1], this.sun[2]);
    gl.uniform2f(gl.getUniformLocation(this.stationProgram, 'u_proj'), proj[0], proj[1]);
    gl.uniform1f(gl.getUniformLocation(this.stationProgram, 'u_mix'), this.mix);
    gl.uniform1f(
      gl.getUniformLocation(this.stationProgram, 'u_pointScale'),
      2.7 * this.dpr * (this.radiusPx / 280),
    );
    gl.uniform1f(gl.getUniformLocation(this.stationProgram, 'u_selected'), this.selectedIndex);
    gl.uniform1f(gl.getUniformLocation(this.stationProgram, 'u_hover'), this.hoveredIndex);
    gl.uniform1f(gl.getUniformLocation(this.stationProgram, 'u_pixelRatio'), this.dpr);
    gl.uniform1f(
      gl.getUniformLocation(this.stationProgram, 'u_time'),
      this.reducedMotion ? 0 : time / 1000,
    );
    gl.drawArrays(gl.POINTS, 0, this.stationCount);
  }

  private starBufferInterleaved: WebGLBuffer | null = null;

  private bindSpriteAttributes(buffer: WebGLBuffer | null): void {
    const gl = this.gl;
    if (!buffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = 5 * 4;
    const pos = gl.getAttribLocation(this.spriteProgram, 'a_pos');
    const size = gl.getAttribLocation(this.spriteProgram, 'a_size');
    const phase = gl.getAttribLocation(this.spriteProgram, 'a_phase');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(size);
    gl.vertexAttribPointer(size, 1, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(phase);
    gl.vertexAttribPointer(phase, 1, gl.FLOAT, false, stride, 4 * 4);
  }

  private bindTerminatorAttributes(m: Float32Array): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.terminator);
    const pos = gl.getAttribLocation(this.spriteProgram, 'a_pos');
    const size = gl.getAttribLocation(this.spriteProgram, 'a_size');
    const phase = gl.getAttribLocation(this.spriteProgram, 'a_phase');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(size);
    gl.vertexAttrib1f(size, 1.0);
    gl.disableVertexAttribArray(phase);
    gl.vertexAttrib1f(phase, 0);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.spriteProgram, 'u_rot'), false, m);
  }

  private bindStationAttributes(): void {
    const gl = this.gl;
    const stride = 13 * 4;
    const loc = (name: string) => gl.getAttribLocation(this.stationProgram, name);
    const attrs: Array<[string, number, number]> = [
      ['a_geo', 3, 0],
      ['a_sky', 3, 3 * 4],
      ['a_color', 3, 6 * 4],
      ['a_size', 1, 9 * 4],
      ['a_health', 1, 10 * 4],
      ['a_match', 1, 11 * 4],
      ['a_index', 1, 12 * 4],
    ];
    for (const [name, size, offset] of attrs) {
      const location = loc(name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    }
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    const canvas = this.canvas;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    const gl = this.gl;
    for (const buffer of Object.values(this.buffers)) {
      if (buffer) gl.deleteBuffer(buffer);
    }
    gl.deleteProgram(this.discProgram);
    gl.deleteProgram(this.stationProgram);
    gl.deleteProgram(this.lineProgram);
    gl.deleteProgram(this.spriteProgram);
    gl.deleteProgram(this.skyLineProgram);
    if (this.mapTexture) gl.deleteTexture(this.mapTexture);
    if (this.fallbackTexture) gl.deleteTexture(this.fallbackTexture);
  }
}
