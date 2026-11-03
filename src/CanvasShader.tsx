import React, { useEffect, useRef } from 'react';

export type ShaderMode = 'stardust' | 'aurora' | 'warp';

interface CanvasShaderProps {
  mode: ShaderMode;
  theme: string;
  paused?: boolean;
}

const THEME_PALETTES: Record<string, string[]> = {
  aurora: ['#8ec5fc', '#e0c3fc', '#ffd1dc', '#a1c4fd'],
  ocean: ['#6ee7b7', '#38bdf8', '#93c5fd', '#67e8f9'],
  pastel: ['#fbcfe8', '#fed7aa', '#fde68a', '#e9d5ff'],
  midnight: ['#c084fc', '#818cf8', '#6366f1', '#e879f9'],
  forest: ['#6ee7b7', '#a7f3d0', '#bef264', '#5eead4'],
  rose: ['#fda4af', '#f472b6', '#e879f9', '#fbcfe8'],
  custom: ['#ffffff', '#e2e8f0', '#f1f5f9', '#ede9fe'],
};

interface Star {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
}

interface WarpStar {
  x: number;
  y: number;
  z: number;
  pz: number;
  color: string;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export function CanvasShader({ mode, theme, paused = false }: CanvasShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean; prevX: number; prevY: number }>({
    x: -1000,
    y: -1000,
    active: false,
    prevX: -1000,
    prevY: -1000,
  });
  const ripplesRef = useRef<Ripple[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colors = THEME_PALETTES[theme] || THEME_PALETTES.aurora;

    // Resize handling
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    // Pointer events
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.prevX = pointerRef.current.x;
      pointerRef.current.prevY = pointerRef.current.y;
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.active = true;
    };

    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      ripplesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        radius: 4,
        maxRadius: Math.min(width, height) * 0.28,
        alpha: 0.65,
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });

    // Initialize mode-specific objects
    // 1. Stardust
    const starCount = Math.max(50, Math.floor((width * height) / 14000));
    const stars: Star[] = Array.from({ length: starCount }, () => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const baseAlpha = 0.25 + Math.random() * 0.55;
      return {
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: 0.8 + Math.random() * 1.6,
        alpha: baseAlpha,
        baseAlpha,
        twinkleSpeed: 0.8 + Math.random() * 2,
        twinklePhase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });

    // 2. Warp Stars
    const warpCount = Math.max(80, Math.floor((width * height) / 9000));
    const warpStars: WarpStar[] = Array.from({ length: warpCount }, () => {
      const z = Math.random() * 1000;
      return {
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z,
        pz: z,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });

    let time = 0;
    let smoothMouseX = width / 2;
    let smoothMouseY = height / 2;

    const render = () => {
      if (paused) return;

      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      // Smooth pointer interpolation
      if (pointerRef.current.active) {
        smoothMouseX += (pointerRef.current.x - smoothMouseX) * 0.08;
        smoothMouseY += (pointerRef.current.y - smoothMouseY) * 0.08;
      } else {
        smoothMouseX += (width / 2 - smoothMouseX) * 0.02;
        smoothMouseY += (height / 2 - smoothMouseY) * 0.02;
      }

      // Update & render ripples
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const rip = ripplesRef.current[i];
        rip.radius += 3.2;
        rip.alpha *= 0.96;
        if (rip.alpha < 0.02 || rip.radius > rip.maxRadius) {
          ripplesRef.current.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${rip.alpha * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (mode === 'stardust') {
        // Constellation distance threshold
        const maxDist = 95;
        const pointerDist = 130;

        // Render gravitational stardust
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];

          if (!prefersReducedMotion) {
            s.x += s.vx;
            s.y += s.vy;

            // Bounce off boundaries softly
            if (s.x < 0) { s.x = 0; s.vx *= -1; }
            if (s.x > width) { s.x = width; s.vx *= -1; }
            if (s.y < 0) { s.y = 0; s.vy *= -1; }
            if (s.y > height) { s.y = height; s.vy *= -1; }

            // Pointer interaction
            if (pointerRef.current.active) {
              const dx = s.x - pointerRef.current.x;
              const dy = s.y - pointerRef.current.y;
              const dist = Math.hypot(dx, dy);
              if (dist < pointerDist && dist > 0) {
                const force = (1 - dist / pointerDist) * 0.9;
                s.vx += (dx / dist) * force;
                s.vy += (dy / dist) * force;
              }
            }

            // Ripple impulse
            for (const rip of ripplesRef.current) {
              const rdx = s.x - rip.x;
              const rdy = s.y - rip.y;
              const rdist = Math.hypot(rdx, rdy);
              const diff = Math.abs(rdist - rip.radius);
              if (diff < 30 && rdist > 0) {
                const push = (1 - diff / 30) * rip.alpha * 2;
                s.vx += (rdx / rdist) * push;
                s.vy += (rdy / rdist) * push;
              }
            }

            // Damping towards natural drift
            s.vx *= 0.96;
            s.vy *= 0.96;
          }

          // Twinkle effect
          const twinkle = prefersReducedMotion ? 1 : 0.7 + 0.3 * Math.sin(time * s.twinkleSpeed + s.twinklePhase);
          const currentAlpha = s.baseAlpha * twinkle;

          // Draw star
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = currentAlpha;
          ctx.shadowBlur = s.radius * 3.5;
          ctx.shadowColor = s.color;
          ctx.fill();

          // Connect constellation lines between stars
          for (let j = i + 1; j < stars.length; j++) {
            const s2 = stars[j];
            const dist = Math.hypot(s.x - s2.x, s.y - s2.y);
            if (dist < maxDist) {
              const lineAlpha = (1 - dist / maxDist) * 0.22 * twinkle;
              ctx.beginPath();
              ctx.moveTo(s.x, s.y);
              ctx.lineTo(s2.x, s2.y);
              ctx.strokeStyle = s.color;
              ctx.globalAlpha = lineAlpha;
              ctx.lineWidth = 0.75;
              ctx.stroke();
            }
          }

          // Connect to pointer if nearby
          if (pointerRef.current.active) {
            const pdist = Math.hypot(s.x - pointerRef.current.x, s.y - pointerRef.current.y);
            if (pdist < pointerDist) {
              const lineAlpha = (1 - pdist / pointerDist) * 0.35;
              ctx.beginPath();
              ctx.moveTo(s.x, s.y);
              ctx.lineTo(pointerRef.current.x, pointerRef.current.y);
              ctx.strokeStyle = s.color;
              ctx.globalAlpha = lineAlpha;
              ctx.lineWidth = 0.9;
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      } else if (mode === 'aurora') {
        // Fluid Aurora Ribbon Waves
        const wavesCount = 3;
        for (let w = 0; w < wavesCount; w++) {
          const color = colors[w % colors.length];
          const baseY = height * (0.35 + w * 0.16);
          const freq = 0.002 + w * 0.001;
          const amp = 40 + w * 25;
          const speed = (w % 2 === 0 ? 1 : -1) * (0.5 + w * 0.25);

          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let x = 0; x <= width; x += 12) {
            // Mouse wave disturbance
            const mdist = pointerRef.current.active ? Math.hypot(x - smoothMouseX, baseY - smoothMouseY) : 999;
            const mouseEffect = mdist < 200 ? Math.sin((1 - mdist / 200) * Math.PI) * 45 : 0;

            const y = baseY
              + Math.sin(x * freq + time * speed) * amp
              + Math.cos(x * freq * 1.8 - time * speed * 0.7) * (amp * 0.4)
              - mouseEffect;

            if (x === 0) ctx.lineTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, baseY - amp, 0, height);
          grad.addColorStop(0, `${color}40`);
          grad.addColorStop(0.5, `${color}15`);
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.globalAlpha = 0.6;
          ctx.fill();

          // Luminous crest stroke
          ctx.beginPath();
          for (let x = 0; x <= width; x += 12) {
            const mdist = pointerRef.current.active ? Math.hypot(x - smoothMouseX, baseY - smoothMouseY) : 999;
            const mouseEffect = mdist < 200 ? Math.sin((1 - mdist / 200) * Math.PI) * 45 : 0;
            const y = baseY
              + Math.sin(x * freq + time * speed) * amp
              + Math.cos(x * freq * 1.8 - time * speed * 0.7) * (amp * 0.4)
              - mouseEffect;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (mode === 'warp') {
        // Cosmic Starfield Warp
        const centerX = width / 2 + (smoothMouseX - width / 2) * 0.25;
        const centerY = height / 2 + (smoothMouseY - height / 2) * 0.25;
        const warpSpeed = prefersReducedMotion ? 0.3 : 3.5;

        for (let i = 0; i < warpStars.length; i++) {
          const s = warpStars[i];
          s.pz = s.z;
          s.z -= warpSpeed;

          if (s.z <= 1) {
            s.z = 1000;
            s.pz = 1000;
            s.x = (Math.random() - 0.5) * width * 1.6;
            s.y = (Math.random() - 0.5) * height * 1.6;
          }

          const k = 250 / s.z;
          const px = s.x * k + centerX;
          const py = s.y * k + centerY;

          const pk = 250 / s.pz;
          const prevPx = s.x * pk + centerX;
          const prevPy = s.y * pk + centerY;

          if (px >= 0 && px <= width && py >= 0 && py <= height) {
            const size = Math.max(0.6, (1 - s.z / 1000) * 2.2);
            const alpha = Math.min(1, (1 - s.z / 1000) * 1.3);

            ctx.beginPath();
            ctx.moveTo(prevPx, prevPy);
            ctx.lineTo(px, py);
            ctx.strokeStyle = s.color;
            ctx.globalAlpha = alpha * 0.75;
            ctx.lineWidth = size;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(px, py, size * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = alpha;
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    if (prefersReducedMotion) {
      render();
    } else {
      animId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [mode, theme, paused]);

  return <canvas ref={canvasRef} className="ambient-shader-canvas" aria-hidden="true" />;
}

