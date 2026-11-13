import React, { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  CalendarRange,
  ArrowLeft,
  FileText,
} from "lucide-react";
import type { ClientProfile, FoodItem, NutritionPlan } from "../types/nutrition";
import { ACTIVITY_LEVEL_LABELS, GOAL_LABELS, VARIETY_MODE_LABELS, WILLINGNESS_LABELS } from "../data/labels";
import { calculateClientNutrition } from "../utils/calculations";
import { TargetCalculatorPanel } from "./TargetCalculatorPanel";
import { HabitsEditor } from "./HabitsEditor";

interface ClientsViewProps {
  clients: ClientProfile[];
  foods: FoodItem[];
  plans: NutritionPlan[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string | null) => void;
  onCreateClientClick: () => void;
  onEditClientClick: (client: ClientProfile) => void;
  onUpdateClient: (client: ClientProfile) => void;
  onDeleteClient: (clientId: string) => void;
  onQueueNewFood: (name: string) => void;
  onOpenPlannerForClient: (clientId: string) => void;
  onOpenSavedPlan: (planId: string) => void;
  onDeletePlan: (planId: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  foods,
  plans,
  selectedClientId,
  onSelectClient,
  onCreateClientClick,
  onEditClientClick,
  onUpdateClient,
  onDeleteClient,
  onQueueNewFood,
  onOpenPlannerForClient,
  onOpenSavedPlan,
  onDeletePlan,
}) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "habits" | "targets" | "plans">("overview");
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<string | null>(null);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) =>
      !q ? true : c.fullName.toLowerCase().includes(q) || GOAL_LABELS[c.goal].toLowerCase().includes(q)
    );
  }, [clients, search]);

  const clientPlans = useMemo(() => {
    if (!selectedClient) return [];
    return plans
      .filter((p) => p.clientId === selectedClient.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [plans, selectedClient]);

  if (selectedClient) {
    const calc = calculateClientNutrition(selectedClient);
    const activeTargets = selectedClient.targetOverrides || calc.recommendedMacros;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onSelectClient(null)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>К списку клиентов</span>
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              {selectedClient.fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 tabular-nums">
              <span>{GOAL_LABELS[selectedClient.goal]}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedClient.age} лет</span>
              <span aria-hidden="true">·</span>
              <span>{selectedClient.heightCm} см / {selectedClient.weightKg} кг</span>
              <span aria-hidden="true">·</span>
              <span>Цель: {activeTargets.calories} ккал</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEditClientClick(selectedClient)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-700 whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Редактировать анкету</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenPlannerForClient(selectedClient.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap"
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Создать рацион</span>
            </button>
          </div>
        </div>

        {/* Profile Sub-Navigation */}
        <div className="border-b border-neutral-200 overflow-x-auto">
          <div className="flex items-center gap-6 min-w-max">
            {[
              { id: "overview", label: "Анкета и параметры" },
              { id: "habits", label: "Пищевые привычки" },
              { id: "targets", label: "Расчёт КБЖУ" },
              { id: "plans", label: `Сохранённые рационы (${clientPlans.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">Антропометрия и активность</h3>
              <dl className="divide-y divide-neutral-100 text-sm">
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Пол / Возраст</dt>
                  <dd className="font-medium text-neutral-900 tabular-nums">
                    {selectedClient.sex === "male" ? "Мужской" : "Женский"}, {selectedClient.age} лет
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Рост / Вес</dt>
                  <dd className="font-medium text-neutral-900 tabular-nums">
                    {selectedClient.heightCm} см / {selectedClient.weightKg} кг
                  </dd>
                </div>
                {selectedClient.bodyFatPercent !== undefined || selectedClient.leanBodyMassKg !== undefined ? (
                  <div className="py-2 flex justify-between gap-4">
                    <dt className="text-neutral-500">Состав тела</dt>
                    <dd className="font-medium text-neutral-900 tabular-nums">
                      {selectedClient.bodyFatPercent !== undefined ? `${selectedClient.bodyFatPercent}% жира` : ""}
                      {selectedClient.leanBodyMassKg !== undefined ? ` LBM ${selectedClient.leanBodyMassKg} кг` : ""}
                    </dd>
                  </div>
                ) : null}
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Профессия</dt>
                  <dd className="font-medium text-neutral-900 text-right">
                    {selectedClient.occupation || "Не указана"}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Бытовая активность</dt>
                  <dd className="font-medium text-neutral-900 text-right max-w-xs">
                    {ACTIVITY_LEVEL_LABELS[selectedClient.activityLevel]}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Шаги / Тренировки</dt>
                  <dd className="font-medium text-neutral-900 tabular-nums text-right">
                    {selectedClient.dailySteps ? `${selectedClient.dailySteps} шаг./день · ` : ""}
                    {selectedClient.strengthFrequencyPerWeek} силовых, {selectedClient.cardioFrequencyPerWeek} кардио/нед
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">Пищевой профиль</h3>
              <dl className="divide-y divide-neutral-100 text-sm">
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Приёмов пищи</dt>
                  <dd className="font-medium text-neutral-900 tabular-nums">
                    {selectedClient.mealsPerDay} в день
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Готовность к изменениям</dt>
                  <dd className="font-medium text-neutral-900 text-right">
                    {WILLINGNESS_LABELS[selectedClient.willingnessToChange]}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Аллергии</dt>
                  <dd className="font-medium text-neutral-900 text-right">
                    {selectedClient.allergies.length > 0 ? selectedClient.allergies.join(", ") : "Нет"}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Ограничения</dt>
                  <dd className="font-medium text-neutral-900 text-right">
                    {selectedClient.restrictions.length > 0 ? selectedClient.restrictions.join(", ") : "Нет"}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-neutral-500">Отказ от продуктов</dt>
                  <dd className="font-medium text-neutral-900 text-right">
                    {selectedClient.refusedFoods.length > 0 ? selectedClient.refusedFoods.join(", ") : "Не указано"}
                  </dd>
                </div>
              </dl>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                {confirmDeleteClient === selectedClient.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700 font-medium">Удалить клиента и его планы?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteClient(selectedClient.id);
                        setConfirmDeleteClient(null);
                      }}
                      className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-medium"
                    >
                      Да, удалить
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteClient(null)}
                      className="px-2.5 py-1 rounded border border-neutral-200 text-xs"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteClient(selectedClient.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить профиль клиента</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "habits" ? (
          <HabitsEditor
            client={selectedClient}
            foods={foods}
            onUpdateClient={onUpdateClient}
            onQueueNewFood={onQueueNewFood}
          />
        ) : null}

        {activeTab === "targets" ? (
          <TargetCalculatorPanel client={selectedClient} onUpdateClient={onUpdateClient} />
        ) : null}

        {activeTab === "plans" ? (
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-neutral-900">
                Сохранённые варианты рациона
              </h3>
              <button
                type="button"
                onClick={() => onOpenPlannerForClient(selectedClient.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Создать новый</span>
              </button>
            </div>
            {clientPlans.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-neutral-500">
                У клиента пока нет сохранённых рационов.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {clientPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">{plan.title}</div>
                      <div className="mt-0.5 text-xs text-neutral-500 tabular-nums">
                        {plan.durationType === "monthly" ? "Месячный (28 дней)" : `Недельный (${plan.days.length} дн.)`} ·{" "}
                        {VARIETY_MODE_LABELS[plan.varietyMode]} · {plan.targets.calories} ккал (Б {plan.targets.protein} / Ж {plan.targets.fat} / У {plan.targets.carbs})
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenSavedPlan(plan.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-800"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Открыть / PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePlan(plan.id)}
                        aria-label="Удалить рацион"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Клиенты</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Профили клиентов, пищевые привычки, расчёты КБЖУ и сохранённые планы питания.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateClientClick}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить клиента</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Поиск клиента по имени или цели..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-neutral-600">
              {clients.length === 0
                ? "Список клиентов пуст."
                : "Клиенты по вашему запросу не найдены."}
            </p>
            {clients.length === 0 ? (
              <button
                type="button"
                onClick={onCreateClientClick}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Создать первого клиента</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {filteredClients.map((client) => {
              const calc = calculateClientNutrition(client);
              const targets = client.targetOverrides || calc.recommendedMacros;
              const planCount = plans.filter((p) => p.clientId === client.id).length;

              return (
                <div
                  key={client.id}
                  className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-neutral-50 transition-colors"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectClient(client.id)}
                      className="text-base font-semibold text-neutral-900 hover:text-emerald-700 text-left truncate block max-w-full"
                    >
                      {client.fullName}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 tabular-nums">
                      <span>{GOAL_LABELS[client.goal]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{client.weightKg} кг / {client.heightCm} см</span>
                      <span aria-hidden="true">·</span>
                      <span>Цель: {targets.calories} ккал (Б {targets.protein} / Ж {targets.fat} / У {targets.carbs})</span>
                      <span aria-hidden="true">·</span>
                      <span>Планов: {planCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectClient(client.id)}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-medium text-neutral-700 whitespace-nowrap"
                    >
                      Открыть профиль
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenPlannerForClient(client.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-medium text-white whitespace-nowrap"
                    >
                      Создать рацион
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
