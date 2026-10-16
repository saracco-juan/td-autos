import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ScrollArea from "./ScrollArea";

describe("ScrollArea", () => {
  it("wraps its children in a named, keyboard-focusable region", () => {
    render(
      <ScrollArea label="Concesionarias">
        <p>fila</p>
      </ScrollArea>,
    );

    const region = screen.getByRole("region", { name: "Concesionarias" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toContainElement(screen.getByText("fila"));
  });

  it("reserves the space of the content above it through a custom property", () => {
    render(
      <ScrollArea label="Lista" offset={480}>
        <p>fila</p>
      </ScrollArea>,
    );

    expect(
      screen
        .getByRole("region", { name: "Lista" })
        .style.getPropertyValue("--scroll-offset"),
    ).toBe("480px");
  });

  it("fits its height to the free space of the page when it sits in <main>", () => {
    render(
      <main>
        <ScrollArea label="Lista">
          <p>fila</p>
        </ScrollArea>
      </main>,
    );

    // jsdom has no layout (every box measures 0), so the fit lands on the minimum height.
    expect(
      screen.getByRole("region", { name: "Lista" }).style.getPropertyValue("--scroll-fit"),
    ).toBe("180px");
  });

  it("flags the sticky table header only when asked", () => {
    render(
      <>
        <ScrollArea label="Tabla" stickyHeader>
          <p>a</p>
        </ScrollArea>
        <ScrollArea label="Grilla">
          <p>b</p>
        </ScrollArea>
      </>,
    );

    expect(screen.getByRole("region", { name: "Tabla" })).toHaveAttribute(
      "data-sticky-header",
    );
    expect(screen.getByRole("region", { name: "Grilla" })).not.toHaveAttribute(
      "data-sticky-header",
    );
  });

  it("puts the box on an outer frame and scrolls the inner region", () => {
    render(
      <ScrollArea label="Lista" className="extra" viewportClassName="inner">
        <p>fila</p>
      </ScrollArea>,
    );

    const region = screen.getByRole("region", { name: "Lista" });
    const frame = region.parentElement as HTMLElement;
    expect(frame).toHaveClass("extra");
    expect(frame).toHaveAttribute("data-scroll-frame");
    expect(region).not.toHaveClass("extra");
    expect(region).toHaveClass("inner");
  });

  it("in fill mode stretches the frame and skips the height fit", () => {
    render(
      <main>
        <ScrollArea label="Lista" fill>
          <p>fila</p>
        </ScrollArea>
      </main>,
    );

    const region = screen.getByRole("region", { name: "Lista" });
    const frame = region.parentElement as HTMLElement;
    expect(frame).toHaveAttribute("data-fill");
    expect(region).toHaveAttribute("data-scroll-region");
    expect(region.style.getPropertyValue("--scroll-fit")).toBe("");
  });

  it("without fill keeps measuring and is not marked as filling", () => {
    render(
      <main>
        <ScrollArea label="Lista">
          <p>fila</p>
        </ScrollArea>
      </main>,
    );

    const region = screen.getByRole("region", { name: "Lista" });
    expect(region.parentElement).not.toHaveAttribute("data-fill");
  });
});
