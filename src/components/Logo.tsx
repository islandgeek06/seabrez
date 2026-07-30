// The SeaBrez wave mark (white strokes, transparent background) for use inside
// the gradient logo tiles. Inherits color via currentColor.
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        <path d="M18 37 q 12 -12 24 0 t 24 0 t 16 0" strokeWidth="9" opacity="0.6" />
        <path d="M14 52 q 13 -13 26 0 t 26 0 t 20 0" strokeWidth="10" />
        <path d="M18 67 q 12 -12 24 0 t 24 0 t 16 0" strokeWidth="9" opacity="0.6" />
      </g>
    </svg>
  )
}
