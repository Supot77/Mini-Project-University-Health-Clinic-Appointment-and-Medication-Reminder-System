"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const STORAGE_KEY = "wu-clinic-theme";

export default function SettingsContent() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved === "dark" ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme =
      theme === "light" ? "dark" : "light";

    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  return (
    <main className="min-h-[calc(100vh-80px)] w-full bg-brand-surface">
      <div className="flex min-h-[calc(100vh-80px)] w-full items-center justify-center px-6">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === "light"
              ? "เปลี่ยนเป็นโหมดมืด"
              : "เปลี่ยนเป็นโหมดสว่าง"
          }
          className={`relative flex h-24 w-44 items-center rounded-full p-2 shadow-lg transition-all duration-300 ${
            theme === "dark"
              ? "justify-end bg-zinc-800"
              : "justify-start bg-white"
          }`}
        >
          <span
            className={`flex h-20 w-20 items-center justify-center rounded-full shadow-md transition-all duration-300 ${
              theme === "dark"
                ? "bg-zinc-700 text-white"
                : "bg-sky-100 text-sky-600"
            }`}
          >
            {theme === "dark" ? (
              <Moon size={34} strokeWidth={2} />
            ) : (
              <Sun size={34} strokeWidth={2} />
            )}
          </span>
        </button>
      </div>
    </main>
  );
}
