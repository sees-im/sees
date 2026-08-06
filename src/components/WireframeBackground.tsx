import { useEffect, useRef } from "react";

/**
 * Monochrome 3D wireframe background.
 * Hand-rolled perspective projection — no external deps.
 * - Rotating icosahedron + outer dodecahedron-ish ring
 * - Mouse parallax + pointer-driven rotation
 * - Subtle starfield particles
 * - Respects prefers-reduced-motion
 */
export function WireframeBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.tx = (e.clientX - rect.left) / rect.width - 0.5;
      mouseRef.current.ty = (e.clientY - rect.top) / rect.height - 0.5;
    };
    window.addEventListener("pointermove", onPointer);

    // --- Geometry: icosahedron ---
    const phi = (1 + Math.sqrt(5)) / 2;
    const icoVerts: [number, number, number][] = [
      [-1, phi, 0],
      [1, phi, 0],
      [-1, -phi, 0],
      [1, -phi, 0],
      [0, -1, phi],
      [0, 1, phi],
      [0, -1, -phi],
      [0, 1, -phi],
      [phi, 0, -1],
      [phi, 0, 1],
      [-phi, 0, -1],
      [-phi, 0, 1],
    ];
    const icoEdges: [number, number][] = [
      [0, 1],
      [0, 5],
      [0, 7],
      [0, 10],
      [0, 11],
      [1, 5],
      [1, 7],
      [1, 8],
      [1, 9],
      [2, 3],
      [2, 4],
      [2, 6],
      [2, 10],
      [2, 11],
      [3, 4],
      [3, 6],
      [3, 8],
      [3, 9],
      [4, 5],
      [4, 9],
      [4, 11],
      [5, 9],
      [5, 11],
      [6, 7],
      [6, 8],
      [6, 10],
      [7, 8],
      [7, 10],
      [8, 9],
      [10, 11],
    ];

    // Outer ring: 24-segment circle in 3D, tilted
    const ringSegs = 48;
    const ringVerts: [number, number, number][] = Array.from({ length: ringSegs }, (_, i) => {
      const a = (i / ringSegs) * Math.PI * 2;
      return [Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6];
    });

    // Starfield
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.1 + 0.2,
    }));

    let t = 0;
    const draw = () => {
      // ease mouse
      mouseRef.current.x += (mouseRef.current.tx - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.ty - mouseRef.current.y) * 0.05;

      t += reduced ? 0.0015 : 0.004;

      ctx.clearRect(0, 0, w, h);

      // Starfield
      ctx.save();
      for (const s of stars) {
        const px = s.x * w + mouseRef.current.x * 30 * s.z;
        const py = s.y * h + mouseRef.current.y * 30 * s.z;
        ctx.globalAlpha = 0.15 + s.z * 0.35;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, s.r * s.z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) * 0.18;
      const focal = 4;

      const rotX = t * 0.6 + mouseRef.current.y * 0.8;
      const rotY = t + mouseRef.current.x * 1.2;

      const project = (v: [number, number, number]) => {
        const [x0, y0, z0] = v;
        // rotate X
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y1 = y0 * cosX - z0 * sinX;
        const z1 = y0 * sinX + z0 * cosX;
        // rotate Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x2 = x0 * cosY + z1 * sinY;
        const z2 = -x0 * sinY + z1 * cosY;
        const persp = focal / (focal + z2);
        return {
          x: cx + x2 * scale * persp,
          y: cy + y1 * scale * persp,
          z: z2,
          d: persp,
        };
      };

      // Outer ring
      const ringProjected = ringVerts.map(project);
      ctx.save();
      ctx.lineWidth = 1;
      for (let i = 0; i < ringSegs; i++) {
        const a = ringProjected[i];
        const b = ringProjected[(i + 1) % ringSegs];
        const alpha = 0.12 + ((a.d + b.d) / 2 - 0.5) * 0.4;
        ctx.strokeStyle = `rgba(255,255,255,${Math.max(0.05, Math.min(0.5, alpha))})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();

      // Icosahedron
      const icoProjected = icoVerts.map(project);
      ctx.save();
      ctx.lineWidth = 1.1;
      for (const [i, j] of icoEdges) {
        const a = icoProjected[i];
        const b = icoProjected[j];
        const depth = (a.d + b.d) / 2;
        const alpha = Math.max(0.08, Math.min(0.9, (depth - 0.55) * 1.6));
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // Vertex glow dots
      for (const p of icoProjected) {
        const alpha = Math.max(0.1, Math.min(1, (p.d - 0.5) * 2));
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6 * p.d, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 w-full h-full"
    />
  );
}
