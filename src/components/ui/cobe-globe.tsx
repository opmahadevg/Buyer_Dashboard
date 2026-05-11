'use client';

import { useEffect, useRef, useCallback } from 'react';
import createGlobe from 'cobe';

interface Marker {
  id: string;
  location: [number, number];
  size?: number;
}

interface GlobeProps {
  markers?: Marker[];
  className?: string;
  markerColor?: [number, number, number];
  baseColor?: [number, number, number];
  glowColor?: [number, number, number];
  dark?: number;
  mapBrightness?: number;
  markerSize?: number;
  speed?: number;
  theta?: number;
  diffuse?: number;
  mapSamples?: number;
}

const SUPPLIER_MARKERS: Marker[] = [
  // ── INDIA (primary — more cities, larger dots) ──
  { id: 'in-mumbai',       location: [19.076,  72.877], size: 0.06 },
  { id: 'in-delhi',        location: [28.613,  77.209], size: 0.06 },
  { id: 'in-bangalore',    location: [12.971,  77.594], size: 0.055 },
  { id: 'in-hyderabad',    location: [17.385,  78.486], size: 0.055 },
  { id: 'in-ahmedabad',    location: [23.022,  72.571], size: 0.055 },
  { id: 'in-chennai',      location: [13.082,  80.270], size: 0.055 },
  { id: 'in-kolkata',      location: [22.572,  88.363], size: 0.055 },
  { id: 'in-pune',         location: [18.520,  73.856], size: 0.05 },
  { id: 'in-surat',        location: [21.170,  72.831], size: 0.05 },
  { id: 'in-jaipur',       location: [26.912,  75.787], size: 0.05 },
  { id: 'in-ludhiana',     location: [30.901,  75.857], size: 0.05 },
  { id: 'in-coimbatore',   location: [11.017,  76.955], size: 0.05 },
  { id: 'in-nagpur',       location: [21.145,  79.088], size: 0.045 },
  { id: 'in-indore',       location: [22.719,  75.857], size: 0.045 },
  { id: 'in-bhopal',       location: [23.259,  77.412], size: 0.045 },
  { id: 'in-patna',        location: [25.594,  85.137], size: 0.045 },
  { id: 'in-vadodara',     location: [22.307,  73.181], size: 0.045 },
  { id: 'in-rajkot',       location: [22.303,  70.802], size: 0.045 },
  { id: 'in-kanpur',       location: [26.449,  80.331], size: 0.045 },
  { id: 'in-lucknow',      location: [26.846,  80.946], size: 0.045 },
  { id: 'in-agra',         location: [27.176,  78.008], size: 0.04 },
  { id: 'in-varanasi',     location: [25.317,  82.973], size: 0.04 },
  { id: 'in-amritsar',     location: [31.634,  74.872], size: 0.04 },
  { id: 'in-jodhpur',      location: [26.292,  73.017], size: 0.04 },
  { id: 'in-kochi',        location: [9.931,   76.267], size: 0.04 },
  { id: 'in-visakhapatnam',location: [17.686,  83.218], size: 0.04 },
  { id: 'in-tirupur',      location: [11.108,  77.341], size: 0.04 },
  { id: 'in-firozabad',    location: [27.152,  78.395], size: 0.04 },
  { id: 'in-moradabad',    location: [28.838,  78.773], size: 0.04 },
  { id: 'in-panipat',      location: [29.390,  76.969], size: 0.04 },
  { id: 'in-jalandhar',    location: [31.326,  75.576], size: 0.04 },
  { id: 'in-gurgaon',      location: [28.459,  77.026], size: 0.04 },
  { id: 'in-noida',        location: [28.535,  77.391], size: 0.04 },
  { id: 'in-bhubaneswar',  location: [20.296,  85.824], size: 0.04 },
  { id: 'in-guwahati',     location: [26.144,  91.736], size: 0.04 },
  { id: 'in-mysuru',       location: [12.295,  76.639], size: 0.04 },
  { id: 'in-madurai',      location: [9.925,   78.119], size: 0.04 },
  { id: 'in-nashik',       location: [19.997,  73.789], size: 0.04 },
  { id: 'in-aurangabad',   location: [19.876,  75.343], size: 0.04 },
  { id: 'in-raipur',       location: [21.251,  81.629], size: 0.04 },

  // ── CHINA (secondary — key manufacturing hubs) ──
  { id: 'cn-shanghai',     location: [31.224, 121.469], size: 0.05 },
  { id: 'cn-beijing',      location: [39.904, 116.407], size: 0.05 },
  { id: 'cn-shenzhen',     location: [22.543, 114.058], size: 0.05 },
  { id: 'cn-guangzhou',    location: [23.129, 113.264], size: 0.045 },
  { id: 'cn-dongguan',     location: [23.020, 113.751], size: 0.045 },
  { id: 'cn-chengdu',      location: [30.572, 104.066], size: 0.045 },
  { id: 'cn-wuhan',        location: [30.593, 114.305], size: 0.045 },
  { id: 'cn-hangzhou',     location: [30.274, 120.155], size: 0.04 },
  { id: 'cn-yiwu',         location: [29.306, 120.075], size: 0.04 },
  { id: 'cn-ningbo',       location: [29.868, 121.544], size: 0.04 },
  { id: 'cn-tianjin',      location: [39.343, 117.361], size: 0.04 },
  { id: 'cn-xian',         location: [34.341, 108.939], size: 0.04 },
  { id: 'cn-foshan',       location: [23.021, 113.121], size: 0.04 },
  { id: 'cn-suzhou',       location: [31.299, 120.585], size: 0.04 },
  { id: 'cn-qingdao',      location: [36.067, 120.382], size: 0.04 },
  { id: 'cn-zhengzhou',    location: [34.746, 113.625], size: 0.04 },
  { id: 'cn-nanjing',      location: [32.060, 118.796], size: 0.04 },
  { id: 'cn-changsha',     location: [28.228, 112.939], size: 0.04 },
  { id: 'cn-kunming',      location: [24.880, 102.832], size: 0.035 },
  { id: 'cn-harbin',       location: [45.803, 126.534], size: 0.035 },
];

export function Globe({
  markers = SUPPLIER_MARKERS,
  className = '',
  markerColor = [0.23, 0.21, 0.91],
  baseColor = [1, 1, 1],
  glowColor = [0.82, 0.82, 0.96],
  dark = 0,
  mapBrightness = 9,
  markerSize = 0.04,
  speed = 0.0015,
  theta = 0.25,
  diffuse = 1.4,
  mapSamples = 20000,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const lastPointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const velocity = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    isPausedRef.current = true;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (pointerInteracting.current !== null) {
      const deltaX = e.clientX - pointerInteracting.current.x;
      const deltaY = e.clientY - pointerInteracting.current.y;
      dragOffset.current = { phi: deltaX / 280, theta: deltaY / 900 };
      const now = Date.now();
      if (lastPointer.current) {
        const dt = Math.max(now - lastPointer.current.t, 1);
        const max = 0.12;
        velocity.current = {
          phi: Math.max(-max, Math.min(max, ((e.clientX - lastPointer.current.x) / dt) * 0.3)),
          theta: Math.max(-max, Math.min(max, ((e.clientY - lastPointer.current.y) / dt) * 0.08)),
        };
      }
      lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
      lastPointer.current = null;
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    isPausedRef.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let animationId: number;
    let phi = 0;

    function init() {
      const width = canvas.offsetWidth;
      if (width === 0 || globe) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width,
        height: width,
        phi: 0,
        theta,
        dark,
        diffuse,
        mapSamples,
        mapBrightness,
        baseColor,
        markerColor,
        glowColor,
        markerElevation: 0.01,
        markers: markers.map((m) => ({ location: m.location, size: m.size ?? markerSize, id: m.id })),
        arcs: [],
        arcColor: markerColor,
        arcWidth: 0,
        arcHeight: 0,
        opacity: 0.85,
      });

      function animate() {
        if (!isPausedRef.current) {
          phi += speed;
          if (Math.abs(velocity.current.phi) > 0.0001 || Math.abs(velocity.current.theta) > 0.0001) {
            phiOffsetRef.current += velocity.current.phi;
            thetaOffsetRef.current += velocity.current.theta;
            velocity.current.phi *= 0.94;
            velocity.current.theta *= 0.94;
          }
          const tMin = -0.35, tMax = 0.35;
          if (thetaOffsetRef.current < tMin) thetaOffsetRef.current += (tMin - thetaOffsetRef.current) * 0.1;
          else if (thetaOffsetRef.current > tMax) thetaOffsetRef.current += (tMax - thetaOffsetRef.current) * 0.1;
        }
        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: theta + thetaOffsetRef.current + dragOffset.current.theta,
          dark,
          mapBrightness,
          markerColor,
          baseColor,
          markerElevation: 0.01,
          markers: markers.map((m) => ({ location: m.location, size: m.size ?? markerSize, id: m.id })),
        });
        animationId = requestAnimationFrame(animate);
      }
      animate();
      setTimeout(() => { if (canvas) canvas.style.opacity = '1'; });
    }

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) { ro.disconnect(); init(); }
      });
      ro.observe(canvas);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
    };
  }, [markers, markerColor, baseColor, glowColor, dark, mapBrightness, markerSize, speed, theta, diffuse, mapSamples]);

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          opacity: 0,
          transition: 'opacity 1.4s ease',
          borderRadius: '50%',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
