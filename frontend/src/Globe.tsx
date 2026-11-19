import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { Pause, Play, RotateCcw, Plus, Minus } from 'lucide-react';

export type GlobePoint = { country: string; total_co2: number; color?: string };
// Representative country locations, not emissions facilities or measured sites.
const locations: Record<string, [number, number]> = {
  Austria: [47.6, 14.1],
  Belgium: [50.8, 4.5],
  Brazil: [-14.2, -51.9],
  Bulgaria: [42.7, 25.5],
  China: [35.9, 104.2],
  Croatia: [45.1, 15.2],
  Cyprus: [35.1, 33.4],
  'Czech Republic': [49.8, 15.5],
  Denmark: [56.3, 9.5],
  Estonia: [58.6, 25],
  Finland: [64.5, 26],
  France: [46.6, 2.2],
  Germany: [51.2, 10.5],
  Greece: [39.1, 21.8],
  Hungary: [47.2, 19.5],
  India: [20.6, 79],
  Ireland: [53.4, -8.2],
  Italy: [42.5, 12.6],
  Japan: [36.2, 138.3],
  Latvia: [56.9, 24.6],
  Lithuania: [55.2, 23.9],
  Luxembourg: [49.8, 6.1],
  Malta: [35.9, 14.4],
  Netherlands: [52.1, 5.3],
  Norway: [60.5, 8.5],
  Poland: [51.9, 19.1],
  Portugal: [39.4, -8.2],
  Romania: [45.9, 24.9],
  'Russian Federation': [61.5, 105.3],
  Slovakia: [48.7, 19.7],
  Slovenia: [46.2, 14.9],
  Spain: [40.5, -3.7],
  Sweden: [62.2, 15.6],
  Switzerland: [46.8, 8.2],
  'United Kingdom': [54, -2],
  'United States': [38.5, -98],
};

function earthCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#a4bbc2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const countries = (
    feature(world as any, world.objects.countries as any) as any
  ).features;
  for (const country of countries) {
    const polygons =
      country.geometry.type === 'Polygon'
        ? [country.geometry.coordinates]
        : country.geometry.coordinates;
    for (const polygon of polygons) {
      // Unwrap dateline-crossing islands before drawing shifted copies. This
      // prevents a Fiji/Russia edge from becoming a line across the whole map.
      const rings = polygon.map((ring: number[][]) => {
        let previous = ring[0][0];
        return ring.map(([longitude, lat]: number[], index: number) => {
          let lon = longitude;
          if (country.id !== '010' && index) {
            while (lon - previous > 180) lon -= 360;
            while (lon - previous < -180) lon += 360;
          }
          previous = lon;
          return [
            ((lon + 180) / 360) * canvas.width,
            ((90 - lat) / 180) * canvas.height,
          ];
        });
      });
      for (const shift of [-canvas.width, 0, canvas.width]) {
        ctx.beginPath();
        for (const ring of rings) {
          ring.forEach(([x, y]: number[], i: number) => {
            i ? ctx.lineTo(x + shift, y) : ctx.moveTo(x + shift, y);
          });
          ctx.closePath();
        }
        ctx.fillStyle = '#e2e3df';
        ctx.fill('evenodd');
        ctx.strokeStyle = '#b7c3c2';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
  }
  return canvas;
}
function earthTexture() {
  const texture = new THREE.CanvasTexture(earthCanvas());
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function position(lat: number, lon: number, radius: number) {
  const a = THREE.MathUtils.degToRad(lat),
    b = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(a) * Math.cos(b),
    Math.sin(a),
    -Math.cos(a) * Math.sin(b),
  ).multiplyScalar(radius);
}

// CPU-rendered orthographic sphere for devices where WebGL is unavailable.
// It samples the same geography and uses the same real country totals.
function startCanvasGlobe(
  container: HTMLDivElement,
  points: GlobePoint[],
  country: string,
  paused: React.MutableRefObject<boolean>,
  reset: React.MutableRefObject<() => void>,
  select: React.MutableRefObject<(name: string) => void>,
  hover: (p: GlobePoint | undefined) => void,
  rotation: React.MutableRefObject<{ x: number; y: number; z: number }>,
  zoom: React.MutableRefObject<number>,
) {
  const canvas = document.createElement('canvas'),
    ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.setAttribute(
    'aria-label',
    'Interactive globe of country-level CO₂ emissions. Drag to rotate; select a marker to explore.',
  );
  container.appendChild(canvas);
  const map = earthCanvas(),
    pixels = map
      .getContext('2d')!
      .getImageData(0, 0, map.width, map.height).data;
  const size = 440,
    half = size / 2,
    buffer = document.createElement('canvas');
  buffer.width = size;
  buffer.height = size;
  const imageCtx = buffer.getContext('2d')!,
    image = imageCtx.createImageData(size, size);
  const normals = new Float32Array(size * size * 3),
    shades = new Float32Array(size * size);
  const inside: number[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = (x - half + 0.5) / (half - 1),
        ny = -(y - half + 0.5) / (half - 1),
        n = 1 - nx * nx - ny * ny;
      if (n < 0) continue;
      const i = y * size + x,
        nz = Math.sqrt(n);
      normals[i * 3] = nx;
      normals[i * 3 + 1] = ny;
      normals[i * 3 + 2] = nz;
      shades[i] = 0.62 + 0.38 * Math.max(0, -0.35 * nx + 0.4 * ny + 0.85 * nz);
      inside.push(i);
      image.data[i * 4 + 3] = Math.min(255, nz * 2550);
    }
  const max = Math.max(1, ...points.map((p) => p.total_co2));
  const dots = points
    .filter((p) => locations[p.country])
    .map((p) => ({
      point: p,
      vector: position(...locations[p.country], 1),
      height: 0.055 + (0.32 * Math.log1p(p.total_co2)) / Math.log1p(max),
    }));
  let width = 1,
    height = 1,
    angle = rotation.current.y,
    drag = false,
    lastX = 0,
    moved = false,
    animation = 0,
    lastFrame = 0,
    visible = true;
  let hits: { point: GlobePoint; x: number; y: number }[] = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const resize = () => {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const ratio = Math.min(window.devicePixelRatio, 1.25);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  });
  intersection.observe(container);
  const render = () => {
    const c = Math.cos(angle),
      sn = Math.sin(angle);
    for (const i of inside) {
      const x = normals[i * 3],
        y = normals[i * 3 + 1],
        z = normals[i * 3 + 2],
        wx = c * x - sn * z,
        wz = sn * x + c * z;
      const u = Math.min(
        map.width - 1,
        Math.max(
          0,
          Math.floor(
            ((Math.atan2(-wz, wx) + Math.PI) / (2 * Math.PI)) * map.width,
          ),
        ),
      );
      const v = Math.min(
        map.height - 1,
        Math.max(0, Math.floor((0.5 - Math.asin(y) / Math.PI) * map.height)),
      );
      const from = (v * map.width + u) * 4,
        to = i * 4,
        shade = shades[i];
      image.data[to] = pixels[from] * shade;
      image.data[to + 1] = pixels[from + 1] * shade;
      image.data[to + 2] = pixels[from + 2] * shade;
    }
    imageCtx.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const r = height * 0.44 * zoom.current,
      cx = width * 0.5,
      cy = height * 0.5;
    const glow = ctx.createRadialGradient(cx, cy, r * 0.98, cx, cy, r * 1.06);
    glow.addColorStop(0, '#9ee5e570');
    glow.addColorStop(0.35, '#81cdd52b');
    glow.addColorStop(1, '#a3ced000');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(buffer, cx - r, cy - r, r * 2, r * 2);
    hits = [];
    for (const dot of dots) {
      const x = c * dot.vector.x + sn * dot.vector.z,
        z = -sn * dot.vector.x + c * dot.vector.z,
        y = dot.vector.y;
      if (z < 0.015) continue;
      const bx = cx + x * r,
        by = cy - y * r,
        tx = cx + x * r * (1 + dot.height),
        ty = cy - y * r * (1 + dot.height),
        active = dot.point.country === country;
      ctx.shadowColor = dot.point.color || '#ffad76';
      ctx.shadowBlur = active ? 14 : 5;
      ctx.strokeStyle = dot.point.color || (active ? '#ffbd88' : '#e38142');
      ctx.lineWidth = active ? 3.5 : 2.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = dot.point.color || '#f29b62';
      ctx.beginPath();
      ctx.arc(bx, by, active ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        const pulse =
          !paused.current && !reduced.matches
            ? (performance.now() % 2400) / 2400
            : 0;
        ctx.strokeStyle = '#ffd3ae';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx, by, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = (1 - pulse) * 0.8;
        ctx.beginPath();
        ctx.arc(bx, by, 10 + pulse * 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0;
      hits.push({ point: dot.point, x: tx, y: ty });
    }
  };
  const find = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    return hits
      .map((h) => ({ ...h, distance: Math.hypot(h.x - x, h.y - y) }))
      .filter((h) => h.distance < 18)
      .sort((a, b) => a.distance - b.distance)[0];
  };
  const down = (e: PointerEvent) => {
    drag = true;
    lastX = e.clientX;
    moved = false;
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (drag) {
      const dx = e.clientX - lastX;
      angle += dx * 0.005;
      lastX = e.clientX;
      if (Math.abs(dx) > 2) moved = true;
      return;
    }
    const h = find(e);
    hover(h?.point);
    canvas.style.cursor = h ? 'pointer' : 'grab';
  };
  const up = (e: PointerEvent) => {
    drag = false;
    if (!moved) {
      const h = find(e);
      if (h) select.current(h.point.country);
    }
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
  };
  const leave = () => hover(undefined);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', leave);
  reset.current = () => {
    angle = -2.25;
    zoom.current = 1;
    render();
  };
  const animate = (now: number) => {
    animation = requestAnimationFrame(animate);
    if (now - lastFrame < 66) return;
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
    lastFrame = now;
    if (visible && !document.hidden) {
      if (!paused.current && !drag && !reduced.matches) angle += dt * 0.085;
      render();
    }
  };
  animation = requestAnimationFrame(animate);
  return () => {
    rotation.current.y = angle;
    cancelAnimationFrame(animation);
    observer.disconnect();
    intersection.disconnect();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('pointerleave', leave);
    canvas.remove();
  };
}

export default function Globe({
  points,
  country,
  onCountry,
  periodLabel = 'August 2026',
  focusCountry = false,
}: {
  points: GlobePoint[];
  country: string;
  onCountry: (name: string) => void;
  periodLabel?: string;
  focusCountry?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    pausedRef = useRef(false),
    resetRef = useRef(() => {}),
    selectRef = useRef(onCountry),
    rotationRef = useRef({ x: 0.12, y: -2.25, z: -0.06 }),
    zoomRef = useRef(1),
    focused = useRef('');
  const [paused, setPaused] = useState(false),
    [unavailable, setUnavailable] = useState(false),
    [hover, setHover] = useState<GlobePoint>();
  useEffect(() => {
    selectRef.current = onCountry;
  }, [onCountry]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    if (focusCountry && focused.current !== country && locations[country]) {
      focused.current = country;
      const [lat, lon] = locations[country];
      rotationRef.current = {
        x: THREE.MathUtils.degToRad(lat),
        y: -THREE.MathUtils.degToRad(90 + lon),
        z: 0,
      };
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      return startCanvasGlobe(
        container,
        points,
        country,
        pausedRef,
        resetRef,
        selectRef,
        setHover,
        rotationRef,
        zoomRef,
      );
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive globe of country-level CO₂ emissions. Drag to rotate; select a marker to explore.',
    );
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    camera.position.z = 3.45;
    const earth = new THREE.Group();
    earth.rotation.set(
      rotationRef.current.x,
      rotationRef.current.y,
      rotationRef.current.z,
    );
    scene.add(earth);
    const texture = earthTexture();
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 96),
      new THREE.MeshPhongMaterial({
        map: texture,
        shininess: 7,
        specular: 0x718589,
      }),
    );
    earth.add(globe);
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.7);
    sun.position.set(-3, 4, 5);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9cb6bd, 0.8);
    fill.position.set(3, -2, 1);
    scene.add(fill);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.018, 80, 48),
      new THREE.MeshBasicMaterial({
        color: 0xabc8d0,
        transparent: true,
        opacity: 0.07,
        side: THREE.BackSide,
      }),
    );
    earth.add(atmosphere);
    const activeRings: THREE.Mesh[] = [];
    const spikes: THREE.Mesh[] = [];
    const maximum = Math.max(1, ...points.map((p) => p.total_co2));
    for (const point of points) {
      const coords = locations[point.country];
      if (!coords) continue;
      const direction = position(...coords, 1),
        height =
          0.055 + (0.32 * Math.log1p(point.total_co2)) / Math.log1p(maximum);
      const active = point.country === country;
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(active ? 0.0045 : 0.003, 0.0045, height, 6),
        new THREE.MeshPhongMaterial({
          color: point.color || (active ? 0xffb176 : 0xd96927),
          emissive: active ? 0x49220c : 0x180900,
          shininess: 15,
        }),
      );
      bar.position.copy(direction.clone().multiplyScalar(1 + height / 2));
      bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      bar.userData = { ...point, direction };
      earth.add(bar);
      spikes.push(bar);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(active ? 0.012 : 0.006, 10, 8),
        new THREE.MeshBasicMaterial({
          color: point.color || (active ? 0xffbd8d : 0xf78b4d),
        }),
      );
      dot.position.copy(direction.clone().multiplyScalar(1.007));
      earth.add(dot);
      if (active) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.022, 0.025, 48),
          new THREE.MeshBasicMaterial({
            color: 0xffc89b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1,
          }),
        );
        ring.position.copy(direction.clone().multiplyScalar(1.009));
        ring.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          direction,
        );
        earth.add(ring);
        activeRings.push(ring);
        const pulse = ring.clone();
        pulse.material = (ring.material as THREE.MeshBasicMaterial).clone();
        earth.add(pulse);
        activeRings.push(pulse);
      }
    }
    const raycaster = new THREE.Raycaster(),
      mouse = new THREE.Vector2();
    let drag = false,
      moved = false,
      lastX = 0,
      lastY = 0,
      previous = 0,
      animation = 0,
      visible = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = reduced.matches;
    const motion = () => {
      reduceMotion = reduced.matches;
    };
    reduced.addEventListener('change', motion);
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const visibility = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    visibility.observe(container);
    const down = (e: PointerEvent) => {
      drag = true;
      moved = false;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (drag) {
        const dx = e.clientX - lastX,
          dy = e.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        earth.rotation.y += dx * 0.005;
        earth.rotation.x = THREE.MathUtils.clamp(
          earth.rotation.x + dy * 0.002,
          -0.7,
          0.7,
        );
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects([globe, ...spikes], false);
      const hit = hits[0];
      if (hit && hit.object !== globe) {
        setHover(hit.object.userData as GlobePoint);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHover(undefined);
        renderer.domElement.style.cursor = 'grab';
      }
    };
    const up = (e: PointerEvent) => {
      drag = false;
      if (!moved) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(mouse, camera);
        const first = raycaster.intersectObjects([globe, ...spikes])[0];
        if (first && first.object !== globe)
          selectRef.current(first.object.userData.country);
      }
      if (renderer.domElement.hasPointerCapture(e.pointerId))
        renderer.domElement.releasePointerCapture(e.pointerId);
    };
    const leave = () => {
      setHover(undefined);
    };
    const contextLost = (e: Event) => {
      e.preventDefault();
      setUnavailable(true);
    };
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('webglcontextlost', contextLost);
    resetRef.current = () => {
      earth.rotation.set(0.12, -2.25, -0.06);
      zoomRef.current = 1;
    };
    const animate = (now: number) => {
      animation = requestAnimationFrame(animate);
      const elapsed = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      if (visible && !document.hidden) {
        if (!pausedRef.current && !drag && !reduceMotion)
          earth.rotation.y += elapsed * 0.085;
        const pulse =
          !pausedRef.current && !reduceMotion ? (now % 2400) / 2400 : 0;
        activeRings.forEach((ring, i) => {
          if (i % 2 === 1) {
            ring.scale.setScalar(1 + pulse * 1.5);
            (ring.material as THREE.MeshBasicMaterial).opacity =
              (1 - pulse) * 0.8;
          }
        });
        camera.position.z = 3.45 / zoomRef.current;
        renderer.render(scene, camera);
      }
    };
    animation = requestAnimationFrame(animate);
    return () => {
      rotationRef.current = {
        x: earth.rotation.x,
        y: earth.rotation.y,
        z: earth.rotation.z,
      };
      cancelAnimationFrame(animation);
      observer.disconnect();
      visibility.disconnect();
      reduced.removeEventListener('change', motion);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('webglcontextlost', contextLost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((m) => m.dispose());
        }
      });
      texture.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [points, country, focusCountry]);
  return (
    <div className="globe-wrap">
      <div ref={host} className="globe-canvas" />
      {unavailable && (
        <div className="globe-unavailable">
          <span>THE WORLD IN CONTEXT</span>
          <p>
            3D rendering is unavailable on this device.
            <br />
            Explore the same country data below.
          </p>
        </div>
      )}
      {hover && (
        <div className="globe-hover">
          <span>{hover.country}</span>
          <strong>
            {hover.total_co2.toLocaleString('en-IN', {
              maximumFractionDigits: 2,
            })}{' '}
            <small>Mt CO₂</small>
          </strong>
          <small>{periodLabel} · selected emissions</small>
        </div>
      )}
      <div className="globe-tools">
        <button
          aria-label={paused ? 'Resume globe rotation' : 'Pause globe rotation'}
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <button
          aria-label="Reset globe view"
          onClick={() => resetRef.current()}
        >
          <RotateCcw size={15} />
        </button>
        <button
          aria-label="Zoom in on globe"
          onClick={() => {
            zoomRef.current = Math.min(1.5, zoomRef.current + 0.1);
          }}
        >
          <Plus size={16} />
        </button>
        <button
          aria-label="Zoom out on globe"
          onClick={() => {
            zoomRef.current = Math.max(0.7, zoomRef.current - 0.1);
          }}
        >
          <Minus size={16} />
        </button>
        <span>Drag to explore</span>
      </div>
    </div>
  );
}
