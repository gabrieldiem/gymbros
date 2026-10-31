import { useState } from 'react';

import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import styles from './PlateCalculator.module.css';
import { BAR_KG, countPlates, platesPerSide } from './plates';

// Plate colours follow the common competition colour code. Decorative only.
const PLATE_STYLE: Record<number, [string, number]> = {
  25: ['#E5242B', 44],
  20: ['#2463EB', 44],
  15: ['#FFE600', 40],
  10: ['#22B35E', 36],
  5: ['#F2F2EE', 28],
  2.5: ['#333333', 24],
  1.25: ['#B8BCC6', 20],
};

const plateWidth = (kg: number) => (kg >= 10 ? 13 : kg >= 5 ? 10 : 8);

type PlateRect = { key: string; x: number; fill: string; h: number; w: number };

/** Plates stack outwards from each collar: right from x=150, left from x=130. */
function plateRects(perSide: number[]): PlateRect[] {
  const widths = perSide.map(plateWidth);
  const offset = (i: number) => widths.slice(0, i).reduce((sum, w) => sum + w + 2, 0);
  return perSide.flatMap((kg, i) => {
    const [fill, h] = PLATE_STYLE[kg] ?? ['#888', 20];
    const w = widths[i] ?? 8;
    return [
      { key: `r${i}`, x: 150 + offset(i), fill, h, w },
      { key: `l${i}`, x: 130 - offset(i) - w, fill, h, w },
    ];
  });
}

function BarDrawing({ perSide, label }: { perSide: number[]; label: string }) {
  return (
    <svg className={styles.svg} viewBox="0 0 280 120" role="img" aria-label={label}>
      <rect x="4" y="56" width="272" height="8" fill="#8E8E8A" />
      <rect x="128" y="50" width="6" height="20" fill="#B8BCC6" />
      <rect x="146" y="50" width="6" height="20" fill="#B8BCC6" />
      {plateRects(perSide).map((p) => (
        <rect
          key={p.key}
          x={p.x}
          y={60 - p.h}
          width={p.w}
          height={p.h * 2}
          rx="2"
          fill={p.fill}
          stroke="#0D0D0D"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

/** How to load a 20 kg bar for a total weight, per side. */
export function PlateCalculator({
  initialKg,
  onClose,
}: {
  initialKg: number;
  onClose: () => void;
}) {
  const { t, n } = useI18n();
  const [kg, setKg] = useState(Math.max(BAR_KG, initialKg));
  const { perSide, leftoverKg } = platesPerSide(kg);
  const list = countPlates(perSide)
    .map(([plate, count]) => `${count} × ${n(plate)} kg`)
    .join(', ');

  return (
    <Sheet title={t('plate_title')} onClose={onClose}>
      <p className={styles.sub}>{t('plate_sub')}</p>
      <div className={styles.input}>
        <button
          type="button"
          aria-label={t('plate_less')}
          onClick={() => setKg((v) => Math.max(BAR_KG, v - 2.5))}
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          step={2.5}
          min={0}
          value={kg}
          aria-label={t('kg_total')}
          onChange={(e) => setKg(Number(e.target.value) || 0)}
        />
        <button type="button" aria-label={t('plate_more')} onClick={() => setKg((v) => v + 2.5)}>
          +
        </button>
        <span className={styles.unit}>{t('kg_total')}</span>
      </div>
      <BarDrawing perSide={perSide} label={t('plate_sub')} />
      <p className={styles.result} role="status">
        {perSide.length ? t('each_side', { x: list }) : t('just_bar')}
      </p>
      {leftoverKg > 0 && <p className={styles.note}>{t('cant_load', { n: n(leftoverKg) })}</p>}
      <div className={styles.done}>
        <Button variant="quiet" wide onClick={onClose}>
          {t('done')}
        </Button>
      </div>
    </Sheet>
  );
}
