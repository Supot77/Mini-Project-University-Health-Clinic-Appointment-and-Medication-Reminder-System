import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home", () => {
  it("shows a visible login CTA in the primary hero actions", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: /เข้าสู่ระบบ/ })).toHaveAttribute("href", "/login");
  });
});
