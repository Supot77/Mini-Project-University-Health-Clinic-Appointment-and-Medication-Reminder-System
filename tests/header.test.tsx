import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/layout/Header";

const authState = vi.hoisted(() => ({
  user: null as null | { full_name: string },
  isAuthenticated: false,
  isLoading: false,
  role: null as string | null,
  signOut: vi.fn(async () => undefined),
}));
const routerState = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/schedules", useRouter: () => routerState }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));

describe("Header", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.role = null;
    authState.signOut.mockClear();
    routerState.replace.mockClear();
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
    authState.role = "staff_admin";

    render(<Header />);

    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /จัดการแผนก/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /คลังยา/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /นัดหมาย/ })).toBeInTheDocument();
  });

  it("shows Dashboard to patients while hiding restricted admin links", () => {
    authState.user = { full_name: "Patient Demo" };
    authState.isAuthenticated = true;
    authState.role = "patient";

    render(<Header />);

    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /จัดการแผนก/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /นัดหมาย/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /แจ้งเตือน/ })).toHaveAttribute("href", "/notifications");
  });

  it("shows only doctor schedules and login for unauthenticated guests", () => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.role = null;

    render(<Header />);

    expect(screen.getByRole("link", { name: /ตารางแพทย์/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dashboard/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /นัดหมาย/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /เตือนยา/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /เข้าสู่ระบบ/ })).toBeInTheDocument();
  });

  it("shows patient search to medical users", () => {
    authState.user = { full_name: "Doctor Demo" };
    authState.isAuthenticated = true;
    authState.role = "medical";

    render(<Header />);

    expect(screen.getByRole("link", { name: /ค้นหาผู้ป่วย/ })).toBeInTheDocument();
  });

  it("opens an accessible mobile menu", () => {
    render(<Header />);
    const toggle = screen.getByRole("button", { name: "เปิดเมนู" });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "เมนูมือถือ" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /เข้าสู่ระบบ/ })).toHaveLength(2);
  });

  it("returns every authenticated role to the public home page after logout", async () => {
    authState.user = { full_name: "Admin Demo" };
    authState.isAuthenticated = true;
    authState.role = "staff_admin";

    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "เปิดเมนูบัญชี" }));
    fireEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" }));

    await waitFor(() => expect(routerState.replace).toHaveBeenCalledWith("/"));
    expect(authState.signOut).toHaveBeenCalledOnce();
  });

  it("uses the profile identity as the only desktop account-menu trigger", () => {
    authState.user = { full_name: "thunyaporn" };
    authState.isAuthenticated = true;
    authState.role = "patient";

    render(<Header />);

    expect(screen.getAllByRole("button", { name: "เปิดเมนูบัญชี" })).toHaveLength(1);
    expect(screen.queryByTitle("thunyaporn")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "เปิดเมนูบัญชี" }));

    expect(screen.getByRole("complementary", { name: "เมนูบัญชี" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ดูโปรไฟล์ของคุณ" })).toHaveAttribute("href", "/profile");
  });
});
