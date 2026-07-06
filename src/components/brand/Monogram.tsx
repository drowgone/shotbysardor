import { cn } from "@/lib/utils";

// Brackets + text — design.md §1.2 viewfinder tizimi.
export function Monogram({
  className,
  size = 32,
  brass = false,
}: {
  className?: string;
  size?: number;
  brass?: boolean;
}) {
  const color = brass ? "var(--accent)" : "var(--text)";
  const arm = size * 0.2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn(className)}
      aria-label="shot by sardor monogramma"
    >
      <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="square">
        <path d={`M2 ${arm + 2}V2H${arm + 2}`} />
        <path d={`M${32 - arm - 2} 2H30V${arm + 2}`} />
        <path d={`M30 ${32 - arm - 2}V30H${32 - arm - 2}`} />
        <path d={`M${arm + 2} 30H2V${32 - arm - 2}`} />
      </g>
      <text
        x="50%"
        y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontFamily="var(--font-display)"
        fontWeight="500"
        fontSize="14"
      >
        S.
      </text>
    </svg>
  );
}

export function Wordmark({
  className,
  animate = false,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 relative",
        animate && "animate-[fadeUp_.4s_var(--ease)_.08s_both]",
        className,
      )}
      style={{ fontFamily: "var(--font-display)", fontWeight: 500, letterSpacing: "-0.01em" }}
    >
      <BracketFrame>
        <span className="px-2">shot by sardor</span>
      </BracketFrame>
    </span>
  );
}

function BracketFrame({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="pointer-events-none absolute inset-0">
        <span className="absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2" style={{ borderColor: "var(--text)" }} />
        <span className="absolute top-0 right-0 w-2 h-2 border-r-2 border-t-2" style={{ borderColor: "var(--text)" }} />
        <span className="absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2" style={{ borderColor: "var(--text)" }} />
        <span className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2" style={{ borderColor: "var(--text)" }} />
      </span>
      {children}
    </span>
  );
}
