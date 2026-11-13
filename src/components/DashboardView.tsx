import React from "react";
import { UserPlus, CalendarRange, ArrowRight, Users } from "lucide-react";
import type { ClientProfile, NutritionPlan } from "../types/nutrition";
import { GOAL_LABELS } from "../data/labels";

interface DashboardViewProps {
  clients: ClientProfile[];
  plans: NutritionPlan[];
  onAddClient: () => void;
  onCreatePlan: (clientId?: string) => void;
  onOpenClient: (clientId: string) => void;
  onGoToClients: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  clients,
  plans,
  onAddClient,
  onCreatePlan,
  onOpenClient,
  onGoToClients,
}) => {
  const recentClients = [...clients]
    .sort((a, b) => new Date(b.lastOpenedAt || b.updatedAt).getTime() - new Date(a.lastOpenedAt || a.updatedAt).getTime())
    .slice(0, 5);

  const plansCountByClient = new Map<string, number>();
  for (const p of plans) {
    plansCountByClient.set(p.clientId, (plansCountByClient.get(p.clientId) || 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Рабочее пространство
        </h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Планирование питания клиентов на основе реальных пищевых привычек и точных расчётов КБЖУ.
        </p>
      </div>

      {/* Primary KPI & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-500">Сохранённые клиенты</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-bold tabular-nums text-neutral-900">
              {clients.length}
            </span>
            {clients.length > 0 ? (
              <button
                type="button"
                onClick={onGoToClients}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Все клиенты</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onAddClient}
          className="bg-white border border-neutral-200 hover:border-emerald-600 rounded-xl p-5 text-left transition-colors group flex flex-col justify-between focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-900">Добавить клиента</span>
            <UserPlus className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
            Быстрое создание профиля за минуту или заполнение полной анкеты привычек.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onCreatePlan()}
          className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl p-5 text-left transition-colors flex flex-col justify-between focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Создать рацион</span>
            <CalendarRange className="w-4 h-4 text-emerald-100" />
          </div>
          <p className="mt-3 text-xs text-emerald-100 leading-relaxed">
            Расчёт КБЖУ, генерация Дня 1 с ИИ, недельное или месячное меню и экспорт в PDF.
          </p>
        </button>
      </div>

      {/* Recently Opened Clients */}
      <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-neutral-900">
            Недавно открытые клиенты
          </h2>
          {clients.length > 0 ? (
            <button
              type="button"
              onClick={onGoToClients}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 whitespace-nowrap"
            >
              Открыть список
            </button>
          ) : null}
        </div>

        {recentClients.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-neutral-600">
              В базе пока нет сохранённых клиентов.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Создайте первый профиль клиента, чтобы рассчитать КБЖУ и сформировать рацион.
            </p>
            <button
              type="button"
              onClick={onAddClient}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Добавить первого клиента</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {recentClients.map((client) => {
              const planCount = plansCountByClient.get(client.id) || 0;
              return (
                <div
                  key={client.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 transition-colors"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenClient(client.id)}
                      className="text-sm font-semibold text-neutral-900 hover:text-emerald-700 text-left truncate block max-w-full"
                    >
                      {client.fullName}
                    </button>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 tabular-nums">
                      <span>{GOAL_LABELS[client.goal]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{client.weightKg} кг</span>
                      <span aria-hidden="true">·</span>
                      <span>{client.mealsPerDay} приёмов пищи</span>
                      <span aria-hidden="true">·</span>
                      <span>Рационов: {planCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenClient(client.id)}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-700 whitespace-nowrap"
                    >
                      Профиль
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreatePlan(client.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-medium text-emerald-800 whitespace-nowrap"
                    >
                      Создать рацион
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
