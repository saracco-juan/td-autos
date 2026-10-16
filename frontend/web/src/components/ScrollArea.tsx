import type { CSSProperties, ReactNode } from "react";
import styles from "./ScrollArea.module.css";

type ScrollAreaProps = {
  /** Accessible name of the region (what the list holds). */
  label: string;
  children: ReactNode;
  /** Pixels taken by what sits above the list on the page (header, cards, filters) plus what sits below it. */
  offset?: number;
  /** Keeps the `<thead>` cells of a table at the top while the rows scroll. */
  stickyHeader?: boolean;
  className?: string;
};

// Tables and result lists scroll inside this box, never the page: the height fits the viewport,
// rows scroll vertically, and columns that cannot fit scroll horizontally in here only.
// Works for a <table>, a list or a CSS grid of cards.
export default function ScrollArea({
  label,
  children,
  offset = 360,
  stickyHeader = false,
  className,
}: ScrollAreaProps) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      data-sticky-header={stickyHeader ? "" : undefined}
      className={className ? `${styles.area} ${className}` : styles.area}
      style={{ "--scroll-offset": `${offset}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
