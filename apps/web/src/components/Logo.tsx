export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <path d="M1 31 12 8l7 11 4-6 10 18z" fill="var(--volt)" />
      <path d="M12 8l3 5-3 2-2-3z" fill="var(--iron)" />
    </svg>
  );
}
