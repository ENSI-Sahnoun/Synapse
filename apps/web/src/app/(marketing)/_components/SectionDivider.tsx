/**
 * Shape divider between two sections — replaces flat gradient fades (which
 * read as a smear at the wrong edge) with a crisp curve exactly at the seam,
 * filled with the color of the section it leads into.
 */
export function SectionDivider({
  fill,
  className = '',
}: {
  fill: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 110"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-x-0 bottom-[-1px] h-[70px] w-full sm:h-[110px] ${className}`}
    >
      <path
        d="M0,32 C240,90 480,8 720,36 C960,64 1200,96 1440,40 L1440,110 L0,110 Z"
        fill={fill}
      />
    </svg>
  );
}
