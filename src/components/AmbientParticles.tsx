import React, { useEffect, useRef } from 'react';

export type ParticleStyle = 'snow' | 'sakura' | 'fireflies' | 'none';

interface AmbientParticlesProps {
  enabled?: boolean;
  style?: ParticleStyle;
}

interface SnowParticle {
  type: 'snow';
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  sway: number;
  swaySpeed: number;
  rotation: number;
  rotationSpeed: number;
  isCrystal: boolean;
  color: string;
}

interface SakuraParticle {
  type: 'sakura';
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  sway: number;
  swaySpeed: number;
  flip: number;
  flipSpeed: number;
  angle: number;
  color: string;
  petalType: number;
}

interface FireflyParticle {
  type: 'firefly';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  glowRadius: number;
  vx: number;
  vy: number;
  baseOpacity: number;
  pulseSpeed: number;
  pulsePhase: number;
  colorCore: string;
  colorGlow: string;
}

type CustomParticle = SnowParticle | SakuraParticle | FireflyParticle;

export default function AmbientParticles({ enabled = false, style = 'snow' }: AmbientParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled || style === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const updateDimensions = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateDimensions();

    const handleResize = () => {
      updateDimensions();
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Initialize particles tailored strictly to the selected style
    let particles: CustomParticle[] = [];
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (style === 'snow') {
      const count = Math.min(75, Math.floor(window.innerWidth / 20));
      const snowColors = ['#ffffff', '#f0f9ff', '#e0f2fe', '#bae6fd'];
      particles = Array.from({ length: count }, (): SnowParticle => ({
        type: 'snow',
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 3.5 + 1.2,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: Math.random() * 1.6 + 0.8,
        opacity: Math.random() * 0.65 + 0.35,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: Math.random() * 0.02 + 0.01,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 1.5,
        isCrystal: Math.random() > 0.4,
        color: snowColors[Math.floor(Math.random() * snowColors.length)],
      }));
    } else if (style === 'sakura') {
      const count = Math.min(55, Math.max(32, Math.floor(window.innerWidth / 24)));
      const sakuraColors = ['#fda4af', '#f472b6', '#fb7185', '#fecdd3', '#ffcad4', '#f9a8d4'];
      particles = Array.from({ length: count }, (): SakuraParticle => ({
        type: 'sakura',
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 5 + 3.5,
        speedX: (Math.random() - 0.35) * 0.9, // Gentle organic breeze with varied direction
        speedY: Math.random() * 1.1 + 0.6,
        opacity: Math.random() * 0.5 + 0.4,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: Math.random() * 0.025 + 0.012,
        flip: Math.random() * Math.PI * 2,
        flipSpeed: Math.random() * 0.04 + 0.02,
        angle: Math.random() * 360,
        color: sakuraColors[Math.floor(Math.random() * sakuraColors.length)],
        petalType: Math.floor(Math.random() * 3),
      }));
    } else if (style === 'fireflies') {
      const count = Math.min(32, Math.floor(window.innerWidth / 40));
      const glowThemes = [
        { core: '#ffffff', glow: 'rgba(250, 204, 21, ' }, // Golden warm firefly
        { core: '#fef08a', glow: 'rgba(163, 230, 53, ' }, // Neon Lime-green firefly
        { core: '#fef9c3', glow: 'rgba(74, 222, 128, ' }, // Forest Emerald firefly
        { core: '#ffffff', glow: 'rgba(251, 191, 36, ' }, // Warm Amber
      ];
      particles = Array.from({ length: count }, (): FireflyParticle => {
        const theme = glowThemes[Math.floor(Math.random() * glowThemes.length)];
        return {
          type: 'firefly',
          x: Math.random() * width,
          y: Math.random() * height,
          targetX: Math.random() * width,
          targetY: Math.random() * height,
          size: Math.random() * 2 + 1.8,
          glowRadius: Math.random() * 14 + 10,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          baseOpacity: Math.random() * 0.4 + 0.5,
          pulseSpeed: Math.random() * 0.03 + 0.015,
          pulsePhase: Math.random() * Math.PI * 2,
          colorCore: theme.core,
          colorGlow: theme.glow,
        };
      });
    }

    // Snowflake geometry renderer (6-branched crystal)
    const drawSnowflake = (c: CanvasRenderingContext2D, size: number) => {
      c.beginPath();
      for (let j = 0; j < 6; j++) {
        c.moveTo(0, 0);
        c.lineTo(0, size * 1.8);
        c.moveTo(0, size * 1.0);
        c.lineTo(size * 0.45, size * 1.4);
        c.moveTo(0, size * 1.0);
        c.lineTo(-size * 0.45, size * 1.4);
        c.rotate(Math.PI / 3);
      }
      c.stroke();
    };

    // Sakura petal geometry renderer with curved edges and cleft notch
    const drawSakuraPetal = (c: CanvasRenderingContext2D, size: number, color: string, opacity: number) => {
      c.beginPath();
      c.moveTo(0, -size);
      // Right petal curve
      c.bezierCurveTo(size * 0.8, -size * 0.5, size * 0.9, size * 0.4, 0, size * 1.2);
      // Left petal curve
      c.bezierCurveTo(-size * 0.9, size * 0.4, -size * 0.8, -size * 0.5, 0, -size);
      c.closePath();

      // Delicate gradient fill
      const grad = c.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      grad.addColorStop(0, color);
      grad.addColorStop(1, '#ffcad4');
      c.fillStyle = grad;
      c.globalAlpha = opacity;
      c.fill();

      // Subtle center vein
      c.beginPath();
      c.moveTo(0, size * 1.0);
      c.lineTo(0, -size * 0.2);
      c.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      c.lineWidth = 0.8;
      c.stroke();
    };

    // Main animation loop decoupled from scroll with performance delta
    const render = (now: number) => {
      const delta = Math.min(32, Math.max(8, now - lastTime)) / 16.666;
      lastTime = now;

      const currentW = window.innerWidth;
      const currentH = window.innerHeight;

      ctx.clearRect(0, 0, currentW, currentH);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (p.type === 'snow') {
          p.sway += p.swaySpeed * delta;
          p.x += (p.speedX + Math.sin(p.sway) * 0.7) * delta;
          p.y += p.speedY * delta;
          p.rotation += p.rotationSpeed * delta;

          if (p.y > currentH + 20) {
            p.y = -20;
            p.x = Math.random() * currentW;
          }
          if (p.x > currentW + 20) p.x = -20;
          if (p.x < -20) p.x = currentW + 20;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);

          if (p.isCrystal) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1.1;
            ctx.globalAlpha = p.opacity;
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#ffffff';
            drawSnowflake(ctx, p.size);
          } else {
            // Soft snow puff
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.opacity;
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.fill();
          }

          ctx.restore();
        } else if (p.type === 'sakura') {
          p.sway += p.swaySpeed * delta;
          p.flip += p.flipSpeed * delta;
          p.x += (p.speedX + Math.sin(p.sway) * 1.1) * delta;
          p.y += (p.speedY + Math.cos(p.sway * 0.7) * 0.35) * delta;
          p.angle += (p.speedX * 0.4 + Math.sin(p.sway) * 0.6) * delta;

          // Seamless edge-wrapping covering all directions and full screen
          if (p.y > currentH + 25) {
            p.y = -25;
            p.x = Math.random() * currentW;
          }
          if (p.x > currentW + 30) {
            p.x = -25;
            p.y = Math.random() * currentH;
          } else if (p.x < -30) {
            p.x = currentW + 25;
            p.y = Math.random() * currentH;
          }

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.angle * Math.PI) / 180);
          // 3D tumble perspective squash
          const scaleX = Math.cos(p.flip);
          const scaleY = 1.0;
          ctx.scale(scaleX, scaleY);

          drawSakuraPetal(ctx, p.size, p.color, p.opacity);
          ctx.restore();
        } else if (p.type === 'firefly') {
          // Floating 2D Brownian wander in space (no gravity)
          p.pulsePhase += p.pulseSpeed * delta;
          const pulse = (Math.sin(p.pulsePhase) + 1) * 0.45 + 0.1;

          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 30 || Math.random() < 0.005) {
            p.targetX = Math.random() * currentW;
            p.targetY = Math.random() * currentH;
          }

          p.vx += ((dx / (dist || 1)) * 0.015 + (Math.random() - 0.5) * 0.04) * delta;
          p.vy += ((dy / (dist || 1)) * 0.015 + (Math.random() - 0.5) * 0.04) * delta;

          p.vx *= Math.pow(0.98, delta);
          p.vy *= Math.pow(0.98, delta);

          p.x += p.vx * delta;
          p.y += p.vy * delta;

          if (p.x < -30) p.x = currentW + 30;
          if (p.x > currentW + 30) p.x = -30;
          if (p.y < -30) p.y = currentH + 30;
          if (p.y > currentH + 30) p.y = -30;

          ctx.save();
          ctx.translate(p.x, p.y);

          const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.glowRadius * (pulse + 0.3));
          glowGrad.addColorStop(0, `${p.colorGlow}${p.baseOpacity * pulse})`);
          glowGrad.addColorStop(0.4, `${p.colorGlow}${p.baseOpacity * pulse * 0.5})`);
          glowGrad.addColorStop(1, `${p.colorGlow}0)`);

          ctx.beginPath();
          ctx.arc(0, 0, p.glowRadius * (pulse + 0.3), 0, Math.PI * 2);
          ctx.fillStyle = glowGrad;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(0, 0, p.size * (pulse * 0.6 + 0.7), 0, Math.PI * 2);
          ctx.fillStyle = p.colorCore;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#ffffff';
          ctx.globalAlpha = Math.min(1, pulse + 0.2);
          ctx.fill();

          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [enabled, style]);

  if (!enabled || style === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      id="ambient-particles-canvas"
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 20,
        transform: 'translate3d(0, 0, 0)',
        willChange: 'transform',
      }}
      className="pointer-events-none fixed inset-0 z-20 w-screen h-screen"
    />
  );
}
