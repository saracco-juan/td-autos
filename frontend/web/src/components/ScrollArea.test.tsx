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
    ).toBe("240px");
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

  it("merges an extra class name", () => {
    render(
      <ScrollArea label="Lista" className="extra">
        <p>fila</p>
      </ScrollArea>,
    );

    expect(screen.getByRole("region", { name: "Lista" })).toHaveClass("extra");
  });
});
