import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/layout/Header";

const authState = vi.hoisted(() => ({
  user: null as null | { id?: string; full_name: string },
  isAuthenticated: false,
  isLoading: false,
  role: null as string | null,
  signOut: vi.fn(async () => undefined),
}));
const routerState = vi.hoisted(() => ({ replace: vi.fn() }));
const dashboardState = vi.hoisted(() => ({
  getUnreadCount: vi.fn(async () => 0),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/schedules", useRouter: () => routerState }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/services/dashboardService", () => ({
  getUnreadCount: (...args: unknown[]) => dashboardState.getUnreadCount(...args),
}));

describe("Header", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.role = null;
    authState.signOut.mockClear();
    routerState.replace.mockClear();
    dashboardState.getUnreadCount.mockReset();
    dashboardState.getUnreadCount.mockResolvedValue(0);
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

    expect(screen.getByRole("link", { name: /ภาพรวม/ })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: /จัดการแผนก/ })).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: /จัดการคลินิก/ }));

    expect(screen.getByRole("link", { name: /จัดการแผนก/ })).toHaveAttribute("href", "/departments");
    expect(screen.getByRole("link", { name: /^นัดหมาย$/ })).toHaveAttribute("href", "/appointments");
    expect(screen.getByRole("link", { name: /ตารางและรอบตรวจ/ })).toHaveAttribute("href", "/schedules");
    expect(screen.getByRole("link", { name: /แจ้งเตือน/ })).toHaveAttribute("href", "/notifications");
  });

  it("shows Dashboard to patients while hiding restricted admin links", () => {
    authState.user = { full_name: "Patient Demo" };
    authState.isAuthenticated = true;
    authState.role = "patient";

    render(<Header />);

    expect(screen.getByRole("link", { name: /ภาพรวม/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /จัดการแผนก/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /นัดหมาย/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /แจ้งเตือน/ })).toHaveAttribute("href", "/notifications");
    expect(screen.queryByRole("link", { name: /เตือนยา/ })).not.toBeInTheDocument();
  });

  it("shows only doctor schedules and login for unauthenticated guests", () => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.role = null;

    render(<Header />);

    expect(screen.getByRole("link", { name: /ตารางแพทย์/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ภาพรวม/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /นัดหมาย/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /เตือนยา/ })).not.toBeInTheDocument();
    const loginLink = screen.getByRole("link", { name: /เข้าสู่ระบบ/ });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveClass("flex");
    expect(loginLink).not.toHaveClass("hidden");
  });

  it("shows patient search to medical users", () => {
    authState.user = { full_name: "Doctor Demo" };
    authState.isAuthenticated = true;
    authState.role = "medical";

    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: /งานตรวจ/ }));

    expect(screen.getByRole("link", { name: /ค้นหาผู้ป่วย/ })).toHaveAttribute("href", "/patients/search");
    expect(screen.getByRole("link", { name: /บันทึกการรักษา/ })).toHaveAttribute("href", "/records");
  });

  it("opens an accessible mobile menu", () => {
    render(<Header />);
    const toggle = screen.getByRole("button", { name: "เปิดเมนู" });
    const brandLink = screen.getByRole("link", { name: /WU Clinic/ });
    expect(toggle.compareDocumentPosition(brandLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "เมนูมือถือ" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /เข้าสู่ระบบ/ })).toHaveLength(2);
  });

  it("keeps grouped links keyboard and touch reachable on mobile", () => {
    authState.user = { full_name: "Patient Demo" };
    authState.isAuthenticated = true;
    authState.role = "patient";

    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "เปิดเมนู" }));
    const mobileNavigation = screen.getByRole("navigation", { name: "เมนูมือถือ" });
    fireEvent.click(within(mobileNavigation).getByRole("button", { name: /สุขภาพของฉัน/ }));

    expect(within(mobileNavigation).getByRole("link", { name: /ประวัติและผลการรักษา/ })).toHaveAttribute("href", "/records");
    expect(within(mobileNavigation).getByRole("link", { name: /เตือนยา/ })).toHaveAttribute("href", "/reminders");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "เมนูมือถือ" })).not.toBeInTheDocument();
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

  it("keeps account shortcuts on routes available to the current role", () => {
    authState.user = { full_name: "Patient Demo" };
    authState.isAuthenticated = true;
    authState.role = "patient";

    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "เปิดเมนูบัญชี" }));

    expect(screen.getByRole("link", { name: "ประวัติการรักษา" })).toHaveAttribute("href", "/records");
    expect(screen.getByRole("link", { name: "เตือนยา" })).toHaveAttribute("href", "/reminders");
    expect(screen.queryByRole("link", { name: "ผลการตรวจ" })).not.toBeInTheDocument();
  });

  it("renders a unified profile menu trigger button without a duplicate hamburger on the right", () => {
    authState.user = { full_name: "Doctor Demo" };
    authState.isAuthenticated = true;
    authState.role = "medical";

    render(<Header />);

    const accountButton = screen.getByRole("button", { name: "เปิดเมนูบัญชี" });
    expect(accountButton).toBeInTheDocument();
    expect(within(accountButton).getByText("Doctor Demo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Doctor Demo/ })).not.toBeInTheDocument();
  });

  it("navigates to dashboard when authenticated and to home when guest on logo click", () => {
    const { unmount } = render(<Header />);
    expect(screen.getByRole("link", { name: /WU Clinic/ })).toHaveAttribute("href", "/");
    unmount();

    authState.user = { full_name: "Patient Demo" };
    authState.isAuthenticated = true;
    authState.role = "patient";

    render(<Header />);
    expect(screen.getByRole("link", { name: /WU Clinic/ })).toHaveAttribute("href", "/dashboard");
  });

  it("renders an unread count badge with exact number when unread notifications exist", async () => {
    authState.user = { id: "user-123", full_name: "Patient Demo" };
    authState.isAuthenticated = true;
    authState.role = "patient";
    dashboardState.getUnreadCount.mockResolvedValue(5);

    render(<Header />);

    const badge = await screen.findByTestId("notification-badge-count");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("5");
    expect(screen.queryByTestId("notification-badge-dot")).not.toBeInTheDocument();
  });

  it("renders a green dot indicator when all notifications have been read", async () => {
    authState.user = { id: "user-123", full_name: "Patient Demo" };
    authState.isAuthenticated = true;
    authState.role = "patient";
    dashboardState.getUnreadCount.mockResolvedValue(0);

    render(<Header />);

    const greenDot = await screen.findByTestId("notification-badge-dot");
    expect(greenDot).toBeInTheDocument();
    expect(screen.queryByTestId("notification-badge-count")).not.toBeInTheDocument();
  });
});
