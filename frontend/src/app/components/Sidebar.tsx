"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  LayoutDashboard,
  UserPlus,
  FileText,
  Building2,
  Clock,
  Zap,
  Scale,
  Globe,
  Hospital,
  Brain,
  Sun,
  Moon,
} from "lucide-react";
import { useI18n, LANGUAGES } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export function Sidebar() {
  const path = usePathname();
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme, isDark } = useTheme();
  const [time, setTime] = useState("");

  const nav = [
    { href: "/triage", label: t("nav.triage"), icon: UserPlus, accent: true },
    { href: "/manage", label: t("nav.manage"), icon: Hospital },
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/patients", label: t("nav.patients"), icon: FileText },
    { href: "/resources", label: t("nav.resources"), icon: Building2 },
    { href: "/fairness", label: t("nav.fairness"), icon: Scale },
    { href: "/drift", label: t("nav.drift"), icon: Brain },
  ];

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className={`w-[272px] flex flex-col shrink-0 relative overflow-hidden backdrop-blur-xl transition-colors duration-300 ${
      isDark
        ? "bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border-r border-white/[0.04]"
        : "bg-gradient-to-b from-white/95 via-slate-50/95 to-slate-100/95 border-r border-slate-200"
    }`}>
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 -right-12 w-40 h-40 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-20 h-60 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Brand */}
      <div className="px-6 py-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-white/10 relative">
            <Activity className="w-5 h-5 text-white" />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-sm shadow-emerald-400/50" />
          </div>
          <div>
            <h1 className={`text-[17px] font-bold tracking-tight flex items-center gap-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
              VIGIL
            </h1>
            <p className={`text-[11px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {t("sidebar.brand")}
            </p>
          </div>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`ml-auto w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isDark
                ? "bg-white/5 hover:bg-white/10 text-amber-400 hover:text-amber-300 ring-1 ring-white/10"
                : "bg-slate-900/5 hover:bg-slate-900/10 text-indigo-500 hover:text-indigo-600 ring-1 ring-slate-200"
            }`}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className={`mx-5 h-px bg-gradient-to-r from-transparent ${isDark ? "via-slate-700" : "via-slate-300"} to-transparent`} />

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 relative z-10">
        {nav.map((item) => {
          const active = path === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative ${
                active
                  ? isDark
                    ? "bg-gradient-to-r from-cyan-600/15 via-blue-600/15 to-indigo-600/10 text-white shadow-sm ring-1 ring-cyan-500/20"
                    : "bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 text-slate-900 shadow-sm ring-1 ring-cyan-500/25"
                  : item.accent
                  ? isDark ? "text-slate-400 hover:bg-white/5 hover:text-cyan-400" : "text-slate-500 hover:bg-slate-100 hover:text-cyan-600"
                  : isDark ? "text-slate-400 hover:bg-white/5 hover:text-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-cyan-400 to-blue-500 shadow-sm shadow-cyan-400/50" />
              )}
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                active
                  ? "bg-cyan-500/20 text-cyan-400"
                  : isDark ? "text-slate-500 group-hover:text-slate-300" : "text-slate-400 group-hover:text-slate-600"
              }`}>
                <item.icon className="w-[18px] h-[18px]" />
              </div>
              {item.label}
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 space-y-3 relative z-10">
        {/* Language selector */}
        <div className="px-1">
          <div className={`flex items-center gap-2 px-3 mb-2 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            <Globe className="w-3.5 h-3.5" />
            <span className="font-medium">{t("nav.language")}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 px-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  lang === l.code
                    ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                    : isDark ? "text-slate-500 hover:bg-white/5 hover:text-slate-300" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                }`}
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>
        {/* Live clock */}
        {time && (
          <div className={`flex items-center gap-2 px-3 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono tracking-wider">{time}</span>
          </div>
        )}
        {/* Engine badge */}
        <div className={`rounded-xl p-3.5 ring-1 relative overflow-hidden ${
          isDark
            ? "bg-gradient-to-r from-cyan-500/8 via-blue-500/8 to-indigo-500/8 ring-cyan-500/10"
            : "bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 ring-cyan-200/50"
        }`}>
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="flex items-center gap-2 mb-1">
            <Zap className={`w-3.5 h-3.5 ${isDark ? "text-cyan-400" : "text-cyan-600"}`} />
            <p className={`text-xs font-semibold ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>{t("sidebar.engine")}</p>
          </div>
          <p className={`text-[10px] leading-relaxed ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            {t("sidebar.engineDesc")}
          </p>
        </div>
      </div>
    </aside>
  );
}
