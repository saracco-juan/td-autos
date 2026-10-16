import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "./ScrollArea.module.css";

type ScrollAreaProps = {
  /** Accessible name of the region (what the list holds). */
  label: string;
  children: ReactNode;
  /** Fallback when the box is not inside <main>: pixels taken by what sits above and below the list. */
  offset?: number;
  /** Keeps the `<thead>` cells of a table at the top while the rows scroll. */
  stickyHeader?: boolean;
  /** Goes on the outer frame (border, background, shadow, radius). */
  className?: string;
  /** Stretches the box over the free height of its flex parent (the list screens' column) instead of fitting a measured height. */
  fill?: boolean;
  /** Goes on the element that scrolls (padding that must scroll with the content, for example). */
  viewportClassName?: string;
};

// Low enough for a phone screen with a header, a search box and pagination around the list.
const MIN_HEIGHT = 180;

// Grows or shrinks the box by the space the page has left: the page's overflow when it scrolls,
// or the empty space at the bottom of <main> when it does not. Converges after one pass.
function fitToPage(area: HTMLElement) {
  const main = area.closest("main");
  if (!main) return;

  const doc = document.documentElement;
  const overflow = doc.scrollHeight - window.innerHeight;
  let slack = -overflow;
  if (overflow <= 0) {
    const page = main.lastElementChild;
    const paddingBottom = parseFloat(getComputedStyle(main).paddingBottom) || 0;
    const pageBottom = page
      ? page.getBoundingClientRect().bottom + (parseFloat(getComputedStyle(page).marginBottom) || 0)
      : main.getBoundingClientRect().top;
    slack = main.getBoundingClientRect().bottom - paddingBottom - pageBottom;
  }

  const target = Math.max(MIN_HEIGHT, Math.floor(area.getBoundingClientRect().height + slack));
  const current = parseFloat(area.style.getPropertyValue("--scroll-fit"));
  if (Number.isNaN(current) || Math.abs(current - target) > 1) {
    area.style.setProperty("--scroll-fit", `${target}px`);
  }
}

// The frame owns the rounded box and clips it; the region inside scrolls, so the scrollbar follows the rounded corners.
// Tables and result lists scroll inside this box, never the page: the height fills what the
// viewport has left, rows scroll vertically, and columns that cannot fit scroll horizontally in here only.
// Works for a <table>, a list or a CSS grid of cards.
export default function ScrollArea({
  label,
  children,
  offset = 360,
  stickyHeader = false,
  fill = false,
  className,
  viewportClassName,
}: ScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const area = ref.current;
    // A filling box gets its height from the layout; nothing to measure.
    if (!area || fill) return;

    const fit = () => fitToPage(area);
    fit();
    window.addEventListener("resize", fit);

    // Content above or below the list can change (an alert shows up, rows load): fit again.
    const main = area.closest("main");
    const observer =
      typeof ResizeObserver === "undefined" || !main ? null : new ResizeObserver(fit);
    if (observer && main) {
      observer.observe(main);
      if (main.lastElementChild) observer.observe(main.lastElementChild);
    }

    return () => {
      window.removeEventListener("resize", fit);
      observer?.disconnect();
    };
  }, [fill]);

  return (
    <div data-scroll-frame="" data-fill={fill ? "" : undefined} className={className ? `${styles.frame} ${className}` : styles.frame}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        data-scroll-region=""
        data-sticky-header={stickyHeader ? "" : undefined}
        className={viewportClassName ? `${styles.area} ${viewportClassName}` : styles.area}
        style={{ "--scroll-offset": `${offset}px` } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
