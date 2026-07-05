export function StarBadge({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 2l2.6 6.2 6.7.5-5.1 4.4 1.6 6.6L12 16.9l-5.8 2.8 1.6-6.6-5.1-4.4 6.7-.5z"
        className="fill-brass stroke-ink"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
