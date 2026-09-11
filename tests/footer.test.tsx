import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Footer from "@/components/layout/Footer";

const authState = vi.hoisted(() => ({
  user: null as null | { full_name: string },
  isAuthenticated: false,
  isLoading: false,
  role: null as string | null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

describe("Footer", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = false;
    authState.role = null;
  });

  it("renders clinic info and general services for guest users and hides staff menus", () => {
    render(<Footer />);

    expect(screen.getByText("WU Clinic")).toBeInTheDocument();
    expect(screen.getByText("บริการคลินิก")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ตารางตรวจแพทย์" })).toHaveAttribute("href", "/schedules");
    expect(screen.getByRole("link", { name: "เข้าสู่ระบบ" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "สมัครสมาชิก" })).toHaveAttribute("href", "/register");

    // Staff menus should NOT be visible to guests
    expect(screen.queryByText("สำหรับบุคลากร")).not.toBeInTheDocument();
    expect(screen.queryByText("เมนูสำหรับแพทย์")).not.toBeInTheDocument();
    expect(screen.queryByText("เมนูผู้ดูแลระบบ")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "แดชบอร์ด" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "คลังยา" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ค้นหาผู้ป่วย" })).not.toBeInTheDocument();
  });

  it("renders patient links for authenticated patient role and hides staff menus", () => {
    authState.isAuthenticated = true;
    authState.role = "patient";
    authState.user = { full_name: "สมหญิง ผู้ป่วย" };

    render(<Footer />);

    expect(screen.getByText("สำหรับผู้ป่วย")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "นัดหมายตรวจ" })).toHaveAttribute("href", "/appointments");
    expect(screen.getByRole("link", { name: "ตารางแพทย์" })).toHaveAttribute("href", "/schedules");
    expect(screen.getByRole("link", { name: "ประวัติการรักษา" })).toHaveAttribute("href", "/records");
    expect(screen.getByRole("link", { name: "แจ้งเตือนทานยา" })).toHaveAttribute("href", "/reminders");
    expect(screen.getByRole("link", { name: "โปรไฟล์ส่วนตัว" })).toHaveAttribute("href", "/profile");

    // Staff menus should NOT be visible to patients
    expect(screen.queryByText("สำหรับบุคลากร")).not.toBeInTheDocument();
    expect(screen.queryByText("เมนูสำหรับแพทย์")).not.toBeInTheDocument();
    expect(screen.queryByText("เมนูผู้ดูแลระบบ")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "คลังยา" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ค้นหาผู้ป่วย" })).not.toBeInTheDocument();
  });

  it("renders medical staff links for authenticated medical role", () => {
    authState.isAuthenticated = true;
    authState.role = "medical";
    authState.user = { full_name: "นพ. สมชาย ใจดี" };

    render(<Footer />);

    expect(screen.getByText("เมนูสำหรับแพทย์")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "แดชบอร์ด" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "ตารางตรวจแพทย์" })).toHaveAttribute("href", "/schedules");
    expect(screen.getByRole("link", { name: "ค้นหาผู้ป่วย" })).toHaveAttribute("href", "/patients/search");
    expect(screen.getByRole("link", { name: "คลังยา" })).toHaveAttribute("href", "/pharmacy");
    expect(screen.getByRole("link", { name: "รายการนัดหมาย" })).toHaveAttribute("href", "/appointments");

    // Should NOT show admin-only accounts or general register
    expect(screen.queryByText("เมนูผู้ดูแลระบบ")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "จัดการข้อมูลผู้ใช้งาน" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "สมัครสมาชิก" })).not.toBeInTheDocument();
  });

  it("renders staff admin links for authenticated staff_admin role", () => {
    authState.isAuthenticated = true;
    authState.role = "staff_admin";
    authState.user = { full_name: "แอดมิน สมบัติ" };

    render(<Footer />);

    expect(screen.getByText("เมนูผู้ดูแลระบบ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "แดชบอร์ด" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "จัดการข้อมูลผู้ใช้งาน" })).toHaveAttribute("href", "/staff/accounts");
    expect(screen.getByRole("link", { name: "จัดการแผนก" })).toHaveAttribute("href", "/departments");
    expect(screen.getByRole("link", { name: "คลังยา" })).toHaveAttribute("href", "/pharmacy");
    expect(screen.getByRole("link", { name: "ตารางตรวจแพทย์" })).toHaveAttribute("href", "/schedules");

    // Should NOT show medical-only or guest register
    expect(screen.queryByText("เมนูสำหรับแพทย์")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "สมัครสมาชิก" })).not.toBeInTheDocument();
  });
});

