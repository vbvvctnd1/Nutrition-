import React, { useState } from "react";
import { X } from "lucide-react";
import type {
  ActivityLevel,
  ClientGoal,
  ClientProfile,
  Sex,
  WillingnessToChange,
} from "../types/nutrition";
import {
  ACTIVITY_LEVEL_LABELS,
  COMMON_ALLERGENS,
  COMMON_RESTRICTIONS,
  GOAL_LABELS,
  WILLINGNESS_LABELS,
} from "../data/labels";
import { getGoalDefaultRate } from "../utils/calculations";

interface ClientModalProps {
  initialClient?: ClientProfile;
  onClose: () => void;
  onSave: (client: ClientProfile) => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  initialClient,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(initialClient);
  const [mode, setMode] = useState<"quick" | "full">(
    initialClient?.questionnaireCompleted ? "full" : "quick"
  );

  const [fullName, setFullName] = useState(initialClient?.fullName || "");
  const [sex, setSex] = useState<Sex>(initialClient?.sex || "female");
  const [age, setAge] = useState<string>(String(initialClient?.age ?? 30));
  const [heightCm, setHeightCm] = useState<string>(String(initialClient?.heightCm ?? 168));
  const [weightKg, setWeightKg] = useState<string>(String(initialClient?.weightKg ?? 65));
  const [bodyFatPercent, setBodyFatPercent] = useState<string>(
    initialClient?.bodyFatPercent !== undefined ? String(initialClient.bodyFatPercent) : ""
  );
  const [leanBodyMassKg, setLeanBodyMassKg] = useState<string>(
    initialClient?.leanBodyMassKg !== undefined ? String(initialClient.leanBodyMassKg) : ""
  );

  const [goal, setGoal] = useState<ClientGoal>(initialClient?.goal || "loss");
  const [desiredWeeklyRateKg, setDesiredWeeklyRateKg] = useState<string>(
    String(initialClient?.desiredWeeklyRateKg ?? getGoalDefaultRate(initialClient?.goal || "loss"))
  );

  // Activity
  const [occupation, setOccupation] = useState(initialClient?.occupation || "");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    initialClient?.activityLevel || "light"
  );
  const [dailySteps, setDailySteps] = useState<string>(
    initialClient?.dailySteps !== undefined ? String(initialClient.dailySteps) : ""
  );
  const [strengthFrequency, setStrengthFrequency] = useState<string>(
    String(initialClient?.strengthFrequencyPerWeek ?? 2)
  );
  const [cardioFrequency, setCardioFrequency] = useState<string>(
    String(initialClient?.cardioFrequencyPerWeek ?? 1)
  );

  // Nutrition preferences
  const [mealsPerDay, setMealsPerDay] = useState<string>(
    String(initialClient?.mealsPerDay ?? 3)
  );
  const [allergies, setAllergies] = useState<string[]>(initialClient?.allergies || []);
  const [customAllergy, setCustomAllergy] = useState("");
  const [restrictions, setRestrictions] = useState<string[]>(initialClient?.restrictions || []);
  const [customRestriction, setCustomRestriction] = useState("");
  const [refusedFoodsText, setRefusedFoodsText] = useState(
    (initialClient?.refusedFoods || []).join(", ")
  );
  const [willingnessToChange, setWillingnessToChange] = useState<WillingnessToChange>(
    initialClient?.willingnessToChange || "moderate"
  );

  const [error, setError] = useState<string | null>(null);

  const handleGoalSelect = (newGoal: ClientGoal) => {
    setGoal(newGoal);
    setDesiredWeeklyRateKg(String(getGoalDefaultRate(newGoal)));
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (list.includes(item)) setList(list.filter((x) => x !== item));
    else setList([...list, item]);
  };

  const handleAddCustomAllergy = () => {
    const trimmed = customAllergy.trim();
    if (!trimmed) return;
    if (!allergies.includes(trimmed)) setAllergies([...allergies, trimmed]);
    setCustomAllergy("");
  };

  const handleAddCustomRestriction = () => {
    const trimmed = customRestriction.trim();
    if (!trimmed) return;
    if (!restrictions.includes(trimmed)) setRestrictions([...restrictions, trimmed]);
    setCustomRestriction("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Укажите имя и фамилию клиента.");
      return;
    }

    const parsedAge = Number(age);
    const parsedHeight = Number(heightCm);
    const parsedWeight = Number(weightKg);

    if (!Number.isFinite(parsedAge) || parsedAge < 14 || parsedAge > 100) {
      setError("Укажите корректный возраст (от 14 до 100 лет).");
      return;
    }
    if (!Number.isFinite(parsedHeight) || parsedHeight < 120 || parsedHeight > 230) {
      setError("Укажите корректный рост в сантиметрах (120–230 см).");
      return;
    }
    if (!Number.isFinite(parsedWeight) || parsedWeight < 30 || parsedWeight > 250) {
      setError("Укажите корректный вес в килограммах (30–250 кг).");
      return;
    }

    const parsedBf = bodyFatPercent.trim() ? Number(bodyFatPercent) : undefined;
    if (parsedBf !== undefined && (Number.isNaN(parsedBf) || parsedBf < 3 || parsedBf > 65)) {
      setError("Процент жира должен быть в диапазоне от 3% до 65% (или оставьте поле пустым).");
      return;
    }

    const parsedLbm = leanBodyMassKg.trim() ? Number(leanBodyMassKg) : undefined;
    if (parsedLbm !== undefined && (Number.isNaN(parsedLbm) || parsedLbm < 20 || parsedLbm >= parsedWeight)) {
      setError("Сухая масса тела должна быть меньше общего веса (или оставьте поле пустым).");
      return;
    }

    const parsedSteps = dailySteps.trim() ? Number(dailySteps) : undefined;
    if (parsedSteps !== undefined && (Number.isNaN(parsedSteps) || parsedSteps < 0 || parsedSteps > 50000)) {
      setError("Укажите корректное количество шагов в день.");
      return;
    }

    const now = new Date().toISOString();
    const refusedFoods = refusedFoodsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const saved: ClientProfile = {
      id: initialClient?.id || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fullName: fullName.trim(),
      sex,
      age: Math.round(parsedAge),
      heightCm: Math.round(parsedHeight),
      weightKg: Number(parsedWeight.toFixed(1)),
      bodyFatPercent: parsedBf,
      leanBodyMassKg: parsedLbm,
      goal,
      desiredWeeklyRateKg:
        goal === "maintenance" ? 0 : Math.max(0, Number(desiredWeeklyRateKg) || 0),
      occupation: occupation.trim(),
      activityLevel,
      dailySteps: parsedSteps !== undefined ? Math.round(parsedSteps) : undefined,
      strengthFrequencyPerWeek: Math.max(0, Math.round(Number(strengthFrequency) || 0)),
      cardioFrequencyPerWeek: Math.max(0, Math.round(Number(cardioFrequency) || 0)),
      mealsPerDay: Math.min(8, Math.max(2, Math.round(Number(mealsPerDay) || 3))),
      favoriteFoodIds: initialClient?.favoriteFoodIds || [],
      dislikedFoodIds: initialClient?.dislikedFoodIds || [],
      regularFoodIds: initialClient?.regularFoodIds || [],
      allergies,
      restrictions,
      refusedFoods,
      willingnessToChange,
      habitDescription: initialClient?.habitDescription || "",
      parsedHabits: initialClient?.parsedHabits || [],
      habitSummary: initialClient?.habitSummary,
      preferredFormula: initialClient?.preferredFormula || "mifflin",
      targetOverrides: initialClient?.targetOverrides,
      questionnaireCompleted: mode === "full",
      createdAt: initialClient?.createdAt || now,
      updatedAt: now,
      lastOpenedAt: now,
    };

    onSave(saved);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-neutral-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              {isEditing ? "Редактировать профиль клиента" : "Новый клиент"}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Выберите быстрое создание или заполните полную анкету сразу.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode switch */}
        <div className="px-6 pt-4">
          <div className="inline-flex p-1 bg-neutral-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode("quick")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === "quick"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Быстрое создание (основное)
            </button>
            <button
              type="button"
              onClick={() => setMode("full")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === "full"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Полная анкета
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {/* Basic Information */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
              Основная информация
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-neutral-700">ФИО клиента *</span>
                <input
                  type="text"
                  required
                  placeholder="Например: Анна Смирнова"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-neutral-700">Пол</span>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as Sex)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                >
                  <option value="female">Женский</option>
                  <option value="male">Мужской</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-neutral-700">Возраст (лет)</span>
                <input
                  type="number"
                  min={14}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-neutral-700">Рост (см)</span>
                <input
                  type="number"
                  min={120}
                  max={230}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-neutral-700">Текущий вес (кг)</span>
                <input
                  type="number"
                  step="0.1"
                  min={30}
                  max={250}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-neutral-700">Основная цель</span>
                <select
                  value={goal}
                  onChange={(e) => handleGoalSelect(e.target.value as ClientGoal)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                >
                  {(Object.keys(GOAL_LABELS) as ClientGoal[]).map((g) => (
                    <option key={g} value={g}>
                      {GOAL_LABELS[g]}
                    </option>
                  ))}
                </select>
              </label>

              {goal !== "maintenance" ? (
                <label className="block">
                  <span className="text-xs font-medium text-neutral-700">
                    Желаемый темп (кг/неделя)
                  </span>
                  <input
                    type="number"
                    step="0.05"
                    min={0.1}
                    max={2.0}
                    value={desiredWeeklyRateKg}
                    onChange={(e) => setDesiredWeeklyRateKg(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </label>
              ) : null}
            </div>
          </section>

          {mode === "full" ? (
            <>
              {/* Optional Body Composition */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
                  Состав тела (необязательно — для формулы Кэтча–МакАрдла)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-medium text-neutral-700">Процент жира (%)</span>
                    <input
                      type="number"
                      step="0.5"
                      min={3}
                      max={60}
                      placeholder="Если известно достоверно"
                      value={bodyFatPercent}
                      onChange={(e) => setBodyFatPercent(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-neutral-700">Сухая масса тела (кг)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Если измерено (DEXA / биоимпеданс)"
                      value={leanBodyMassKg}
                      onChange={(e) => setLeanBodyMassKg(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                    />
                  </label>
                </div>
              </section>

              {/* Activity */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
                  Активность и образ жизни
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-neutral-700">
                      Профессия и общий образ жизни
                    </span>
                    <input
                      type="text"
                      placeholder="Например: программист, удалённая работа"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-neutral-700">
                      Уровень бытовой активности
                    </span>
                    <select
                      value={activityLevel}
                      onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                    >
                      {(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {ACTIVITY_LEVEL_LABELS[lvl]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-neutral-700">
                      Среднее число шагов в день (если известно)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={40000}
                      step={500}
                      placeholder="Например: 7500"
                      value={dailySteps}
                      onChange={(e) => setDailySteps(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-neutral-700">Силовые / нед</span>
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={strengthFrequency}
                        onChange={(e) => setStrengthFrequency(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-neutral-700">Кардио / нед</span>
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={cardioFrequency}
                        onChange={(e) => setCardioFrequency(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              </section>

              {/* Preferences */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
                  Предпочтения и ограничения в питании
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-medium text-neutral-700">
                      Количество приёмов пищи в день
                    </span>
                    <select
                      value={mealsPerDay}
                      onChange={(e) => setMealsPerDay(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                    >
                      {[2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} приёмов пищи
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-neutral-700">
                      Готовность менять привычки
                    </span>
                    <select
                      value={willingnessToChange}
                      onChange={(e) => setWillingnessToChange(e.target.value as WillingnessToChange)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                    >
                      {(Object.keys(WILLINGNESS_LABELS) as WillingnessToChange[]).map((w) => (
                        <option key={w} value={w}>
                          {WILLINGNESS_LABELS[w]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <span className="text-xs font-medium text-neutral-700 block mb-2">
                    Аллергии
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ALLERGENS.map((item) => {
                      const active = allergies.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleItem(allergies, setAllergies, item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            active
                              ? "bg-red-50 border-red-300 text-red-800"
                              : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Добавить другую аллергию..."
                      value={customAllergy}
                      onChange={(e) => setCustomAllergy(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomAllergy();
                        }
                      }}
                      className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomAllergy}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-xs font-medium text-neutral-700"
                    >
                      Добавить
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-neutral-700 block mb-2">
                    Диетические ограничения
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_RESTRICTIONS.map((item) => {
                      const active = restrictions.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleItem(restrictions, setRestrictions, item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            active
                              ? "bg-amber-50 border-amber-300 text-amber-900"
                              : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Добавить ограничение..."
                      value={customRestriction}
                      onChange={(e) => setCustomRestriction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomRestriction();
                        }
                      }}
                      className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomRestriction}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-xs font-medium text-neutral-700"
                    >
                      Добавить
                    </button>
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs font-medium text-neutral-700">
                    Продукты, от которых клиент категорически отказывается (через запятую)
                  </span>
                  <input
                    type="text"
                    placeholder="Например: сельдерей, печень, морепродукты"
                    value={refusedFoodsText}
                    onChange={(e) => setRefusedFoodsText(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </label>
              </section>
            </>
          ) : (
            <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3 text-xs text-neutral-600">
              После быстрого создания вы сможете в любой момент заполнить уровень активности, аллергии и анкету пищевых привычек в профиле клиента.
            </div>
          )}

          <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-sm font-medium text-neutral-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors"
            >
              {isEditing ? "Сохранить изменения" : "Создать клиента"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
