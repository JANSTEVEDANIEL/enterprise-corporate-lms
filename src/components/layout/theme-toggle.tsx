"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("lms_theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      // Default to dark slate for modern EdTech marketplace experience
      document.documentElement.classList.add("dark");
      setTheme("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("lms_theme", nextTheme);
    document.cookie = `lms_theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-lg bg-slate-800/50 border border-slate-700/50 animate-pulse ${className}`} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Slate Mode"}
      className={`relative inline-flex items-center justify-center w-8 h-8 rounded-lg backdrop-blur-md bg-slate-800/70 hover:bg-slate-700/80 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 border border-slate-700/50 dark:border-slate-700/60 text-slate-200 hover:text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${className}`}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-400 transition-transform duration-200 rotate-0 hover:-rotate-12" />
      )}
    </button>
  );
}
