import { useEffect, useRef } from 'react';

import styles from './Confetti.module.css';

const COLORS = ['#FFE600', '#FF3B1F', '#00D1FF', '#FF4FD8', '#B48CFF', '#F2F2EE'];
const COUNT = 90;
const DURATION_MS = 2600;
const GRAVITY = 900;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  color: string;
};

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function launch(width: number): Piece[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    x: width / 2,
    y: -10,
    vx: (Math.random() - 0.5) * width * 1.1,
    vy: 120 + Math.random() * 420,
    size: 5 + Math.random() * 7,
    spin: (Math.random() - 0.5) * 14,
    color: COLORS[i % COLORS.length] ?? '#FFE600',
  }));
}

/** A one-time burst for reward moments (a PR, a badge, the weekly goal). Decorative. */
export function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext?.('2d');
    if (!element || !context || reducedMotion()) return;
    element.width = element.clientWidth;
    element.height = element.clientHeight;
    const pieces = launch(element.width);
    const began = performance.now();
    let frame = requestAnimationFrame(function draw(now) {
      const t = (now - began) / 1000;
      const progress = (now - began) / DURATION_MS;
      context.clearRect(0, 0, element.width, element.height);
      context.globalAlpha = Math.max(0, 1 - progress * progress);
      for (const piece of pieces) {
        context.save();
        context.translate(piece.x + piece.vx * t, piece.y + piece.vy * t + GRAVITY * t * t * 0.5);
        context.rotate(piece.spin * t);
        context.scale(1, Math.cos(piece.spin * t * 1.3));
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        context.restore();
      }
      if (progress < 1) frame = requestAnimationFrame(draw);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />;
}
