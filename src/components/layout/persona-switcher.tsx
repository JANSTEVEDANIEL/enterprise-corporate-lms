"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Role, SessionUser } from "@/types";
import { ChevronDown, ShieldCheck, UserCheck, Briefcase, Award } from "lucide-react";

interface PersonaSwitcherProps {
  initialUser?: SessionUser;
}

const ROLE_BADGE_STYLES: Record<Role, { bg: string; text: string; border: string; label: string }> = {
  EMPLOYEE: {
    bg: "bg-blue-50 text-blue-700",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Employee",
  },
  MANAGER: {
    bg: "bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Manager",
  },
  COMPLIANCE_OFFICER: {
    bg: "bg-purple-50 text-purple-700",
    text: "text-purple-700",
    border: "border-purple-200",
    label: "Compliance Officer",
  },
  SUPER_ADMIN: {
    bg: "bg-rose-50 text-rose-700",
    text: "text-rose-700",
    border: "border-rose-200",
    label: "Super Admin",
  },
};

export function PersonaSwitcher({ initialUser }: PersonaSwitcherProps) {
  const [currentUser, setCurrentUser] = useState<SessionUser | undefined>(initialUser);
  const [personas, setPersonas] = useState<SessionUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json();
        if (json.success) {
          if (!currentUser) {
            setCurrentUser(json.data.currentUser);
          }
          setPersonas(json.data.personas || []);
        }
      } catch {
        // ignore in non-browser/build
      }
    }
    loadSession();
  }, [currentUser]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPersona = async (persona: SessionUser) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: persona.id }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(persona);
        setIsOpen(false);
        // Force full page reload so all server components update their session context
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to switch persona", err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentRole = currentUser?.role || "EMPLOYEE";
  const badgeStyle = ROLE_BADGE_STYLES[currentRole];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        title="Switch persona role for testing & evaluation"
      >
        {/* Avatar / Initials */}
        <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold tracking-wider">
          {currentUser?.name
            ? currentUser.name
                .split(" ")
                .map((n) => n[0])
                .join("")
            : "U"}
        </div>

        {/* User Details */}
        <div className="text-left hidden sm:block">
          <div className="text-xs font-medium text-slate-900 leading-none flex items-center gap-1.5">
            <span>{currentUser?.name || "Select Persona"}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${badgeStyle.bg} ${badgeStyle.border}`}
            >
              {badgeStyle.label}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
            {currentUser?.department || "Corporate"} • {currentUser?.jobTitle || "Role"}
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-2 border-b border-slate-100">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Dev & Demo Persona Switcher
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Instantly toggle identity to evaluate role-specific views and permissions.
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto py-1">
            {personas.map((p) => {
              const isSelected = p.id === currentUser?.id;
              const pBadge = ROLE_BADGE_STYLES[p.role];

              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPersona(p)}
                  className={`w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-slate-50 transition-colors ${
                    isSelected ? "bg-slate-50/80 font-medium" : ""
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 ${
                      isSelected ? "bg-brand-600 ring-2 ring-brand-200" : "bg-slate-700"
                    }`}
                  >
                    {p.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {p.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${pBadge.bg} ${pBadge.border}`}
                      >
                        {pBadge.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                      {p.jobTitle}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {p.department} Department • {p.email}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3.5 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              RBAC Session Guard Active
            </span>
            <span className="text-slate-400">Node:SQLite</span>
          </div>
        </div>
      )}
    </div>
  );
}
