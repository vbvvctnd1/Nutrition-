import React from "react";
import {
  LayoutDashboard,
  Users,
  CalendarRange,
  Database,
  Settings,
  Plus,
} from "lucide-react";
import type { AppRoute, TrainerSettings } from "../types/nutrition";

interface LayoutProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onQuickCreatePlan: () => void;
  settings: TrainerSettings;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: AppRoute; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Главная", shortLabel: "Главная", icon: LayoutDashboard },
  { id: "clients", label: "Клиенты", shortLabel: "Клиенты", icon: Users },
  { id: "planner", label: "Создать рацион", shortLabel: "Рацион", icon: CalendarRange },
  { id: "foods", label: "База продуктов", shortLabel: "Продукты", icon: Database },
  { id: "settings", label: "Настройки", shortLabel: "Настройки", icon: Settings },
];

export const Layout: React.FC<LayoutProps> = ({
  activeRoute,
  onNavigate,
  onQuickCreatePlan,
  settings,
  children,
}) => {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8F9FA] text-[#111827]">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 bg-white border-r border-neutral-200 min-h-screen sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-neutral-200 flex items-center gap-3">
          {settings.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.brandTitle}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded object-cover border border-neutral-200 shrink-0"
            />
          ) : null}
          <div className="min-w-0">
            <div className="font-display font-bold text-base tracking-tight text-neutral-900 truncate">
              НутриПлан
            </div>
            <div className="text-xs text-neutral-500 truncate">
              {settings.trainerName || "Кабинет тренера"}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-700" : "text-neutral-400"}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={onQuickCreatePlan}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Новый рацион</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-20">
        <div className="font-display font-bold text-base tracking-tight text-neutral-900 whitespace-nowrap shrink-0">
          НутриПлан
        </div>
        <button
          type="button"
          onClick={onQuickCreatePlan}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Создать рацион</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 pb-20 md:pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Мобильная навигация"
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 z-30 grid grid-cols-5"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 min-h-[56px] text-[11px] font-medium transition-colors ${
                isActive ? "text-emerald-700" : "text-neutral-500"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="truncate max-w-full">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
