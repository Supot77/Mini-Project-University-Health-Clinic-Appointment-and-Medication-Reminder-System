import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/layout/Header";

const authState = vi.hoisted(() => ({
  user: null as null | { full_name: string },
  isAuthenticated: false,
  isLoading: false,
  role: null as string | null,
  signOut: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/schedules" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));

describe("Header", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.role = null;
    authState.signOut.mockClear();
  });

  it("uses one primary header and avoids duplicate desktop navigation", () => {
    render(<Header />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getAllByText("WU Clinic")).toHaveLength(1);
    expect(screen.getAllByText("ตารางแพทย์")).toHaveLength(1);
    expect(screen.queryByText("ระบบบริการสุขภาพและนัดหมายแพทย์ มหาวิทยาลัยวลัยลักษณ์")).not.toBeInTheDocument();
  });

  it("keeps every main route reachable while editing in demo mode", () => {
    authState.user = { full_name: "Admin Demo" };
    authState.isAuthenticated = true;
    authState.role = "admin";

    render(<Header />);

    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /คลังยา/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /นัดหมาย/ })).toBeInTheDocument();
  });

  it("hides Dashboard from authenticated patients", () => {
    authState.user = { full_name: "Patient Demo" };
    authState.isAuthenticated = true;
    authState.role = "patient";

    render(<Header />);

    expect(screen.queryByRole("link", { name: /Dashboard/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /นัดหมาย/ })).toBeInTheDocument();
  });

  it("opens an accessible mobile menu", () => {
    render(<Header />);
    const toggle = screen.getByRole("button", { name: "เปิดเมนู" });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "เมนูมือถือ" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /เข้าสู่ระบบ/ })).toHaveLength(2);
  });
});
