export function CowboyHat({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.65)}
      viewBox="0 0 34 22"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M9 17c0-9 3-14 8-14s8 5 8 14z" className="fill-ink" />
      <ellipse cx="17" cy="17" rx="16" ry="4.5" className="fill-ink" />
      <rect x="9" y="13" width="16" height="2.5" className="fill-brass" />
    </svg>
  );
}
