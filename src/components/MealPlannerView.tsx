import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Check,
  Plus,
  Trash2,
  ArrowLeftRight,
  FileText,
  Save,
  RefreshCw,
  AlertCircle,
  Copy,
  ChefHat,
} from "lucide-react";
import type {
  ClientProfile,
  DayPlan,
  FoodItem,
  Meal,
  NutritionPlan,
  PlanDurationType,
  TrainerSettings,
  VarietyMode,
} from "../types/nutrition";
import { GOAL_LABELS, PREPARATION_STATE_LABELS, VARIETY_MODE_LABELS } from "../data/labels";
import { calculateClientNutrition } from "../utils/calculations";
import {
  calculateDayTotals,
  calculateIngredientMacros,
  calculateMealTotals,
  formatHouseholdMeasurement,
  isFoodAllowedForClient,
  scaleDayIngredientsToTarget,
} from "../utils/mealMath";
import { aiService, type GeneratedMealRaw } from "../services/aiService";
import { SubstitutionModal } from "./SubstitutionModal";
import { PdfPreviewModal } from "./PdfPreviewModal";

interface MealPlannerViewProps {
  clients: ClientProfile[];
  foods: FoodItem[];
  plans: NutritionPlan[];
  settings: TrainerSettings;
  initialClientId: string | null;
  initialPlanId: string | null;
  onSavePlan: (plan: NutritionPlan) => void;
  onCreateClientClick: () => void;
}

const WEEKDAY_NAMES = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

function createEmptyMeals(count: number): Meal[] {
  const defaultNames = ["Завтрак", "Перекус", "Обед", "Полдник", "Ужин", "Поздний ужин"];
  return Array.from({ length: count }, (_, idx) => ({
    id: `meal_${Date.now()}_${idx}`,
    name: defaultNames[idx] || `Приём пищи ${idx + 1}`,
    instructions: "",
    ingredients: [],
  }));
}

export const MealPlannerView: React.FC<MealPlannerViewProps> = ({
  clients,
  foods,
  plans,
  settings,
  initialClientId,
  initialPlanId,
  onSavePlan,
  onCreateClientClick,
}) => {
  const existingPlan = useMemo(
    () => (initialPlanId ? plans.find((p) => p.id === initialPlanId) || null : null),
    [plans, initialPlanId]
  );

  const [selectedClientId, setSelectedClientId] = useState<string>(
    existingPlan?.clientId || initialClientId || clients[0]?.id || ""
  );

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const foodsMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const allowedFoods = useMemo(() => {
    if (!selectedClient) return foods.filter((f) => f.verificationStatus !== "ai_pending");
    return foods.filter((f) => isFoodAllowedForClient(f, selectedClient));
  }, [foods, selectedClient]);

  const calc = useMemo(
    () => (selectedClient ? calculateClientNutrition(selectedClient) : null),
    [selectedClient]
  );

  const activeTargets = useMemo(() => {
    if (existingPlan && existingPlan.clientId === selectedClientId) {
      return existingPlan.targets;
    }
    if (selectedClient?.targetOverrides) return selectedClient.targetOverrides;
    if (calc) return calc.recommendedMacros;
    return { calories: 2000, protein: 140, fat: 65, carbs: 210, formulaUsed: "mifflin" as const };
  }, [existingPlan, selectedClientId, selectedClient, calc]);

  // Plan configuration state
  const [planId, setPlanId] = useState<string>(existingPlan?.id || `plan_${Date.now()}`);
  const [planTitle, setPlanTitle] = useState<string>(
    existingPlan?.title ||
      (selectedClient ? `Рацион: ${selectedClient.fullName}` : "Персональный рацион")
  );
  const [durationType, setDurationType] = useState<PlanDurationType>(
    existingPlan?.durationType || "weekly"
  );
  const [varietyMode, setVarietyMode] = useState<VarietyMode>(
    existingPlan?.varietyMode || "moderate"
  );
  const [days, setDays] = useState<DayPlan[]>(
    existingPlan?.days || []
  );
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);

  // Generation & Feedback state
  const [isGeneratingDay1, setIsGeneratingDay1] = useState(false);
  const [isGeneratingWeek, setIsGeneratingWeek] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Modals
  const [substitutingTarget, setSubstitutingTarget] = useState<{
    dayIdx: number;
    mealId: string;
    ingredientId: string;
    food: FoodItem;
    grams: number;
  } | null>(null);

  const [addIngredientTarget, setAddIngredientTarget] = useState<{
    dayIdx: number;
    mealId: string;
  } | null>(null);
  const [addFoodId, setAddFoodId] = useState<string>("");
  const [addFoodGrams, setAddFoodGrams] = useState<string>("100");
  const [addFoodSearch, setAddFoodSearch] = useState<string>("");

  const [replacingMealTarget, setReplacingMealTarget] = useState<{
    dayIdx: number;
    mealId: string;
    currentCalories: number;
  } | null>(null);

  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [trainerRecs, setTrainerRecs] = useState(
    existingPlan?.trainerRecommendations || settings.defaultRecommendations
  );
  const [trainerComments, setTrainerComments] = useState(existingPlan?.trainerComments || "");

  const handleClientSelect = (newClientId: string) => {
    setSelectedClientId(newClientId);
    const cli = clients.find((c) => c.id === newClientId);
    setPlanId(`plan_${Date.now()}`);
    setPlanTitle(cli ? `Рацион: ${cli.fullName}` : "Персональный рацион");
    setDays([]);
    setActiveDayIndex(0);
    setAiError(null);
    setAiRationale(null);
    setSaveSuccess(null);
  };

  const mapRawMealsToVerified = (rawMeals: GeneratedMealRaw[]): Meal[] => {
    return rawMeals.map((m, mIdx) => ({
      id: `meal_${Date.now()}_${mIdx}_${Math.random().toString(36).slice(2, 5)}`,
      name: m.name || `Приём пищи ${mIdx + 1}`,
      instructions: m.instructions || "",
      isBatchPrepped: Boolean(m.isBatchPrepped),
      batchNote: m.batchNote || undefined,
      ingredients: (m.ingredients || [])
        .filter((ing) => foodsMap.has(ing.foodId) && ing.grams > 0)
        .map((ing, iIdx) => ({
          id: `ing_${Date.now()}_${mIdx}_${iIdx}_${Math.random().toString(36).slice(2, 5)}`,
          foodId: ing.foodId,
          grams: Math.max(5, Math.round(ing.grams)),
        })),
    }));
  };

  // STEP 2: Generate Day 1 with Gemini AI
  const handleGenerateDay1 = async () => {
    if (!selectedClient) return;
    setAiError(null);
    setSaveSuccess(null);
    setIsGeneratingDay1(true);

    try {
      const res = await aiService.generateDay1(
        selectedClient,
        activeTargets,
        varietyMode,
        foods
      );
      const mappedMeals = mapRawMealsToVerified(res.meals || []);
      const initialDay1: DayPlan = {
        dayNumber: 1,
        dayLabel: "День 1 (Понедельник)",
        approved: false,
        meals: mappedMeals.length > 0 ? mappedMeals : createEmptyMeals(selectedClient.mealsPerDay),
      };

      const scaledDay1 = scaleDayIngredientsToTarget(initialDay1, activeTargets, foodsMap);
      setDays([scaledDay1]);
      setActiveDayIndex(0);
      setAiRationale(res.rationale || null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Ошибка генерации Дня 1.");
    } finally {
      setIsGeneratingDay1(false);
    }
  };

  const handleStartManualDay1 = () => {
    if (!selectedClient) return;
    setDays([
      {
        dayNumber: 1,
        dayLabel: "День 1 (Понедельник)",
        approved: false,
        meals: createEmptyMeals(selectedClient.mealsPerDay),
      },
    ]);
    setActiveDayIndex(0);
    setAiError(null);
  };

  // STEP 4: Approve Day 1
  const handleApproveDay1 = () => {
    setDays((prev) =>
      prev.map((d, idx) => (idx === 0 ? { ...d, approved: true } : d))
    );
  };

  // STEP 5 & 6: Generate remaining days based on approved Day 1
  const handleGenerateRemainingDays = async () => {
    if (!selectedClient || days.length === 0) return;
    const approvedDay1 = days[0];
    setAiError(null);
    setIsGeneratingWeek(true);

    try {
      const res = await aiService.generateRemainingDays(
        selectedClient,
        approvedDay1,
        6,
        activeTargets,
        varietyMode,
        foods
      );

      const weekDays: DayPlan[] = [approvedDay1];
      const generated = res.days || [];

      for (let i = 0; i < 6; i++) {
        const dayNum = i + 2;
        const raw = generated[i];
        const rawMeals = raw ? mapRawMealsToVerified(raw.meals || []) : [];
        const dayDraft: DayPlan = {
          dayNumber: dayNum,
          dayLabel: `День ${dayNum} (${WEEKDAY_NAMES[(dayNum - 1) % 7]})`,
          approved: true,
          meals:
            rawMeals.length > 0
              ? rawMeals
              : approvedDay1.meals.map((m) => ({
                  ...m,
                  id: `meal_${Date.now()}_${dayNum}_${Math.random().toString(36).slice(2, 5)}`,
                  ingredients: m.ingredients.map((ing) => ({
                    ...ing,
                    id: `ing_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                  })),
                })),
        };
        weekDays.push(scaleDayIngredientsToTarget(dayDraft, activeTargets, foodsMap));
      }

      if (durationType === "monthly") {
        // Expand 7-day cycle into 4 weeks (28 days) cleanly with independent editable copies
        const fullMonth: DayPlan[] = [];
        for (let week = 0; week < 4; week++) {
          for (let dIdx = 0; dIdx < 7; dIdx++) {
            const template = weekDays[dIdx];
            const globalDayNum = week * 7 + dIdx + 1;
            fullMonth.push({
              dayNumber: globalDayNum,
              dayLabel: `Неделя ${week + 1} · День ${dIdx + 1} (${WEEKDAY_NAMES[dIdx]})`,
              approved: true,
              meals: template.meals.map((m) => ({
                ...m,
                id: `meal_${globalDayNum}_${Math.random().toString(36).slice(2, 5)}`,
                ingredients: m.ingredients.map((ing) => ({
                  ...ing,
                  id: `ing_${globalDayNum}_${Math.random().toString(36).slice(2, 5)}`,
                })),
              })),
            });
          }
        }
        setDays(fullMonth);
      } else {
        setDays(weekDays);
      }
      setActiveDayIndex(1);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Ошибка при генерации остальных дней недели.");
    } finally {
      setIsGeneratingWeek(false);
    }
  };

  // Manual fallback: Clone Day 1 across week/month
  const handleDuplicateDay1 = () => {
    if (days.length === 0) return;
    const template = { ...days[0], approved: true };
    const totalDays = durationType === "monthly" ? 28 : 7;
    const allDays: DayPlan[] = [];
    for (let i = 0; i < totalDays; i++) {
      const week = Math.floor(i / 7) + 1;
      const dayInWeek = (i % 7) + 1;
      allDays.push({
        dayNumber: i + 1,
        dayLabel:
          durationType === "monthly"
            ? `Неделя ${week} · День ${dayInWeek} (${WEEKDAY_NAMES[i % 7]})`
            : `День ${i + 1} (${WEEKDAY_NAMES[i % 7]})`,
        approved: true,
        meals: template.meals.map((m) => ({
          ...m,
          id: `meal_${i}_${Math.random().toString(36).slice(2, 5)}`,
          ingredients: m.ingredients.map((ing) => ({
            ...ing,
            id: `ing_${i}_${Math.random().toString(36).slice(2, 5)}`,
          })),
        })),
      });
    }
    setDays(allDays);
  };

  // Editing helpers for current day
  const currentDay = days[activeDayIndex] || null;
  const currentDayTotals = useMemo(
    () => (currentDay ? calculateDayTotals(currentDay, foodsMap) : { calories: 0, protein: 0, fat: 0, carbs: 0 }),
    [currentDay, foodsMap]
  );

  const updateDayAt = (dayIdx: number, updater: (day: DayPlan) => DayPlan) => {
    setDays((prev) => prev.map((d, idx) => (idx === dayIdx ? updater(d) : d)));
    setSaveSuccess(null);
  };

  const handleChangeIngredientGrams = (dayIdx: number, mealId: string, ingId: string, grams: number) => {
    updateDayAt(dayIdx, (day) => ({
      ...day,
      meals: day.meals.map((m) =>
        m.id === mealId
          ? {
              ...m,
              ingredients: m.ingredients.map((i) =>
                i.id === ingId ? { ...i, grams: Math.max(0, Math.round(grams)) } : i
              ),
            }
          : m
      ),
    }));
  };

  const handleRemoveIngredient = (dayIdx: number, mealId: string, ingId: string) => {
    updateDayAt(dayIdx, (day) => ({
      ...day,
      meals: day.meals.map((m) =>
        m.id === mealId
          ? { ...m, ingredients: m.ingredients.filter((i) => i.id !== ingId) }
          : m
      ),
    }));
  };

  const handleAddMeal = (dayIdx: number) => {
    updateDayAt(dayIdx, (day) => ({
      ...day,
      meals: [
        ...day.meals,
        {
          id: `meal_${Date.now()}`,
          name: `Приём пищи ${day.meals.length + 1}`,
          instructions: "",
          ingredients: [],
        },
      ],
    }));
  };

  const handleRemoveMeal = (dayIdx: number, mealId: string) => {
    updateDayAt(dayIdx, (day) => ({
      ...day,
      meals: day.meals.filter((m) => m.id !== mealId),
    }));
  };

  const handleConfirmAddIngredient = () => {
    if (!addIngredientTarget || !addFoodId) return;
    const grams = Math.max(1, Math.round(Number(addFoodGrams) || 100));
    updateDayAt(addIngredientTarget.dayIdx, (day) => ({
      ...day,
      meals: day.meals.map((m) =>
        m.id === addIngredientTarget.mealId
          ? {
              ...m,
              ingredients: [
                ...m.ingredients,
                {
                  id: `ing_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                  foodId: addFoodId,
                  grams,
                },
              ],
            }
          : m
      ),
    }));
    setAddIngredientTarget(null);
    setAddFoodSearch("");
  };

  const buildPlanObject = (overrideId?: string): NutritionPlan => {
    const now = new Date().toISOString();
    return {
      id: overrideId || planId,
      clientId: selectedClientId,
      title: planTitle.trim() || `Рацион: ${selectedClient?.fullName || ""}`,
      durationType,
      varietyMode,
      targets: activeTargets,
      days,
      trainerRecommendations: trainerRecs,
      trainerComments,
      createdAt: existingPlan?.createdAt || now,
      updatedAt: now,
    };
  };

  const handleSaveCurrentPlan = (asNewVariant = false) => {
    if (!selectedClient || days.length === 0) return;
    const targetId = asNewVariant ? `plan_${Date.now()}` : planId;
    if (asNewVariant) setPlanId(targetId);
    const planObj = buildPlanObject(targetId);
    onSavePlan(planObj);
    setSaveSuccess(
      asNewVariant
        ? "Сохранён как новый вариант рациона в профиле клиента."
        : "Рацион сохранён в профиле клиента."
    );
  };

  if (clients.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center space-y-3">
        <h1 className="text-xl font-bold text-neutral-900">Создать рацион</h1>
        <p className="text-sm text-neutral-600 max-w-md mx-auto">
          Чтобы рассчитать целевое КБЖУ и составить план питания, сначала добавьте хотя бы одного клиента.
        </p>
        <button
          type="button"
          onClick={onCreateClientClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить клиента</span>
        </button>
      </div>
    );
  }

  const calDiff = currentDayTotals.calories - activeTargets.calories;
  const calDiffPct = Math.abs(calDiff) / Math.max(1, activeTargets.calories);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Конструктор рациона
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Шаг 1: Цели → Шаг 2: Генерация и правка Дня 1 → Шаг 3: Расширение на неделю/месяц и экспорт в PDF.
          </p>
        </div>

        {days.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSaveCurrentPlan(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-800 whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Сохранить</span>
            </button>
            {existingPlan ? (
              <button
                type="button"
                onClick={() => handleSaveCurrentPlan(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-800 whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Сохранить как новый вариант</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                handleSaveCurrentPlan(false);
                setIsPdfOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Экспорт PDF</span>
            </button>
          </div>
        ) : null}
      </div>

      {saveSuccess ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-medium text-emerald-900">
          {saveSuccess}
        </div>
      ) : null}

      {/* Step 1: Configuration & Targets */}
      <section className="bg-white border border-neutral-200 rounded-xl p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Клиент</span>
            <select
              value={selectedClientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({GOAL_LABELS[c.goal]})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Название плана</span>
            <input
              type="text"
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Длительность плана</span>
            <select
              value={durationType}
              onChange={(e) => setDurationType(e.target.value as PlanDurationType)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            >
              <option value="weekly">На неделю (7 дней)</option>
              <option value="monthly">На месяц (4 недели / 28 дней)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Режим разнообразия</span>
            <select
              value={varietyMode}
              onChange={(e) => setVarietyMode(e.target.value as VarietyMode)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            >
              {(Object.keys(VARIETY_MODE_LABELS) as VarietyMode[]).map((m) => (
                <option key={m} value={m}>
                  {VARIETY_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Target summary bar */}
        {selectedClient ? (
          <div className="pt-4 border-t border-neutral-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm tabular-nums">
              <span>
                Цель: <strong className="text-neutral-900">{activeTargets.calories} ккал</strong>
              </span>
              <span>
                Белки: <strong className="text-neutral-900">{activeTargets.protein} г</strong>
              </span>
              <span>
                Жиры: <strong className="text-neutral-900">{activeTargets.fat} г</strong>
              </span>
              <span>
                Углеводы: <strong className="text-neutral-900">{activeTargets.carbs} г</strong>
              </span>
              <span className="text-xs text-neutral-500">
                {selectedClient.mealsPerDay} приёмов пищи
                {selectedClient.allergies.length > 0 ? ` · Аллергии: ${selectedClient.allergies.join(", ")}` : ""}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isGeneratingDay1}
                onClick={handleGenerateDay1}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-medium whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isGeneratingDay1
                    ? "ИИ составляет День 1..."
                    : days.length === 0
                      ? "Сгенерировать День 1 с ИИ"
                      : "Перегенерировать День 1"}
                </span>
              </button>
              {days.length === 0 ? (
                <button
                  type="button"
                  onClick={handleStartManualDay1}
                  className="px-3.5 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 whitespace-nowrap"
                >
                  Создать День 1 вручную
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {aiError ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{aiError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={days.length > 0 && days[0].approved ? handleGenerateRemainingDays : handleGenerateDay1}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-medium text-red-800 hover:bg-red-100"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Повторить</span>
            </button>
            {days.length === 0 ? (
              <button
                type="button"
                onClick={handleStartManualDay1}
                className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs font-medium text-neutral-700"
              >
                Собрать вручную
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {aiRationale ? (
        <div className="rounded-xl bg-white border border-neutral-200 px-4 py-3 text-xs text-neutral-600">
          <strong className="text-neutral-900">Логика подбора ИИ:</strong> {aiRationale}
        </div>
      ) : null}

      {/* Step 4 Banner: Approve Day 1 -> Generate Rest of Week/Month */}
      {days.length > 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-neutral-900">
              {days[0].approved
                ? days.length > 1
                  ? `План сформирован (${days.length} дн.). Проверьте приёмы пищи и при необходимости отредактируйте.`
                  : "День 1 утверждён. Теперь можно сгенерировать остальные дни."
                : "Проверьте и отредактируйте День 1, затем утвердите его для генерации всей программы."}
            </div>
            <div className="text-xs text-neutral-500">
              Все граммовки и КБЖУ рассчитаны по проверенной базе продуктов.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!days[0].approved ? (
              <button
                type="button"
                onClick={handleApproveDay1}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap"
              >
                <Check className="w-4 h-4" />
                <span>Утвердить День 1</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isGeneratingWeek}
                  onClick={handleGenerateRemainingDays}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-medium whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isGeneratingWeek
                      ? "Генерация дней..."
                      : durationType === "monthly"
                        ? "Сгенерировать 4 недели (28 дн.) с ИИ"
                        : "Сгенерировать неделю (Дни 2–7) с ИИ"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleDuplicateDay1}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Скопировать День 1</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Day Tabs */}
      {days.length > 1 ? (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {days.map((d, idx) => {
            const totals = calculateDayTotals(d, foodsMap);
            return (
              <button
                key={d.dayNumber}
                type="button"
                onClick={() => setActiveDayIndex(idx)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  activeDayIndex === idx
                    ? "bg-emerald-700 border-emerald-700 text-white"
                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span>{durationType === "monthly" ? `Д${d.dayNumber}` : `День ${d.dayNumber}`}</span>
                <span className={`ml-1.5 ${activeDayIndex === idx ? "text-emerald-100" : "text-neutral-400"}`}>
                  {totals.calories} ккал
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Active Day Meals Editor */}
      {currentDay ? (
        <div className="space-y-4">
          {/* Day Totals Bar */}
          <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900">{currentDay.dayLabel}</h2>
              <div className="text-xs text-neutral-500 mt-0.5">
                Факт по дню vs Целевой ориентир ({activeTargets.calories} ккал)
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm font-mono tabular-nums">
              <span
                className={`font-semibold ${
                  calDiffPct <= 0.08 ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {currentDayTotals.calories} ккал ({calDiff >= 0 ? `+${calDiff}` : calDiff})
              </span>
              <span className="text-neutral-700">
                Б {currentDayTotals.protein} / {activeTargets.protein} г
              </span>
              <span className="text-neutral-700">
                Ж {currentDayTotals.fat} / {activeTargets.fat} г
              </span>
              <span className="text-neutral-700">
                У {currentDayTotals.carbs} / {activeTargets.carbs} г
              </span>
            </div>
          </div>

          {/* Meals List */}
          <div className="space-y-4">
            {currentDay.meals.map((meal) => {
              const mealTotals = calculateMealTotals(meal, foodsMap);

              return (
                <div
                  key={meal.id}
                  className="bg-white border border-neutral-200 rounded-xl overflow-hidden"
                >
                  <div className="px-5 py-3.5 border-b border-neutral-200 bg-neutral-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="text"
                        value={meal.name}
                        onChange={(e) =>
                          updateDayAt(activeDayIndex, (d) => ({
                            ...d,
                            meals: d.meals.map((m) =>
                              m.id === meal.id ? { ...m, name: e.target.value } : m
                            ),
                          }))
                        }
                        className="font-semibold text-sm text-neutral-900 bg-transparent border-b border-transparent focus:border-emerald-600 focus:outline-none w-full max-w-md"
                      />
                      {meal.isBatchPrepped ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 whitespace-nowrap shrink-0">
                          <ChefHat className="w-3.5 h-3.5" />
                          <span>{meal.batchNote || "Заготовка"}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono tabular-nums font-medium text-neutral-700">
                        {mealTotals.calories} ккал · Б {mealTotals.protein} · Ж {mealTotals.fat} · У {mealTotals.carbs}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setReplacingMealTarget({
                            dayIdx: activeDayIndex,
                            mealId: meal.id,
                            currentCalories:
                              mealTotals.calories > 0
                                ? mealTotals.calories
                                : Math.round(activeTargets.calories / Math.max(1, currentDay.meals.length)),
                          })
                        }
                        className="px-2 py-1 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-[11px] font-medium text-neutral-700 whitespace-nowrap"
                      >
                        Заменить приём
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveMeal(activeDayIndex, meal.id)}
                        aria-label="Удалить приём пищи"
                        className="p-1 text-neutral-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className="divide-y divide-neutral-100">
                    {meal.ingredients.length === 0 ? (
                      <div className="px-5 py-4 text-xs text-neutral-400">
                        Ингредиенты не добавлены. Нажмите «Добавить продукт».
                      </div>
                    ) : (
                      meal.ingredients.map((ing) => {
                        const food = foodsMap.get(ing.foodId);
                        const macros = calculateIngredientMacros(food, ing.grams);
                        const household = formatHouseholdMeasurement(food, ing.grams);

                        return (
                          <div
                            key={ing.id}
                            className="px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-neutral-900">
                                {food ? food.name : "Продукт удалён из базы"}
                              </div>
                              <div className="text-xs text-neutral-500 tabular-nums">
                                {food ? PREPARATION_STATE_LABELS[food.preparationState] : ""}
                                {household ? ` · ${household}` : ""}
                                {" · "}
                                <span className="font-mono">
                                  {macros.calories} ккал (Б {macros.protein} / Ж {macros.fat} / У {macros.carbs})
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={2000}
                                  value={ing.grams}
                                  onChange={(e) =>
                                    handleChangeIngredientGrams(
                                      activeDayIndex,
                                      meal.id,
                                      ing.id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-20 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono tabular-nums text-right focus:border-emerald-600 focus:outline-none"
                                />
                                <span className="text-xs text-neutral-500">г</span>
                              </div>

                              {food ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSubstitutingTarget({
                                      dayIdx: activeDayIndex,
                                      mealId: meal.id,
                                      ingredientId: ing.id,
                                      food,
                                      grams: ing.grams,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 whitespace-nowrap"
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Заменить продукт</span>
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveIngredient(activeDayIndex, meal.id, ing.id)
                                }
                                aria-label="Удалить ингредиент"
                                className="p-1.5 text-neutral-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Meal footer: Add ingredient & Instructions */}
                  <div className="px-5 py-3 bg-neutral-50/40 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAddFoodId(allowedFoods[0]?.id || "");
                          setAddFoodGrams("100");
                          setAddIngredientTarget({ dayIdx: activeDayIndex, mealId: meal.id });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить продукт</span>
                      </button>

                      {varietyMode === "batch" ? (
                        <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(meal.isBatchPrepped)}
                            onChange={(e) =>
                              updateDayAt(activeDayIndex, (d) => ({
                                ...d,
                                meals: d.meals.map((m) =>
                                  m.id === meal.id
                                    ? {
                                        ...m,
                                        isBatchPrepped: e.target.checked,
                                        batchNote: e.target.checked ? m.batchNote || "Заготовка на 2–3 дня" : undefined,
                                      }
                                    : m
                                ),
                              }))
                            }
                            className="accent-emerald-700"
                          />
                          <span>Заготовка заранее</span>
                        </label>
                      ) : null}
                    </div>

                    <input
                      type="text"
                      placeholder="Краткая инструкция приготовления (при необходимости)..."
                      value={meal.instructions || ""}
                      onChange={(e) =>
                        updateDayAt(activeDayIndex, (d) => ({
                          ...d,
                          meals: d.meals.map((m) =>
                            m.id === meal.id ? { ...m, instructions: e.target.value } : m
                          ),
                        }))
                      }
                      className="flex-1 max-w-md rounded border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => handleAddMeal(activeDayIndex)}
            className="w-full py-2.5 rounded-xl border border-dashed border-neutral-300 hover:border-emerald-600 text-xs font-medium text-neutral-600 hover:text-emerald-800 transition-colors"
          >
            + Добавить приём пищи в {currentDay.dayLabel}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm text-neutral-600">
            Нажмите «Сгенерировать День 1 с ИИ», чтобы получить персональный проект рациона на основе привычек и целей клиента, или соберите первый день вручную.
          </p>
        </div>
      )}

      {/* Substitution Modal */}
      {substitutingTarget && selectedClient ? (
        <SubstitutionModal
          originalFood={substitutingTarget.food}
          originalGrams={substitutingTarget.grams}
          allFoods={foods}
          client={selectedClient}
          onClose={() => setSubstitutingTarget(null)}
          onConfirmReplacement={(newFoodId, newGrams) => {
            updateDayAt(substitutingTarget.dayIdx, (d) => ({
              ...d,
              meals: d.meals.map((m) =>
                m.id === substitutingTarget.mealId
                  ? {
                      ...m,
                      ingredients: m.ingredients.map((ing) =>
                        ing.id === substitutingTarget.ingredientId
                          ? { ...ing, foodId: newFoodId, grams: newGrams }
                          : ing
                      ),
                    }
                  : m
              ),
            }));
            setSubstitutingTarget(null);
          }}
        />
      ) : null}

      {/* Add Ingredient Modal */}
      {addIngredientTarget ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-bold text-neutral-900">Добавить продукт в приём пищи</h3>
            <input
              type="text"
              placeholder="Фильтр по названию..."
              value={addFoodSearch}
              onChange={(e) => setAddFoodSearch(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
            <select
              value={addFoodId}
              onChange={(e) => setAddFoodId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            >
              {allowedFoods
                .filter((f) =>
                  !addFoodSearch.trim()
                    ? true
                    : f.name.toLowerCase().includes(addFoodSearch.trim().toLowerCase())
                )
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.caloriesPer100g} ккал / 100 г)
                  </option>
                ))}
            </select>
            <label className="block">
              <span className="text-xs font-medium text-neutral-700">Количество (граммы)</span>
              <input
                type="number"
                min={1}
                value={addFoodGrams}
                onChange={(e) => setAddFoodGrams(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddIngredientTarget(null)}
                className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmAddIngredient}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* PDF Export Preview Modal */}
      {isPdfOpen && selectedClient && days.length > 0 ? (
        <PdfPreviewModal
          plan={buildPlanObject()}
          client={selectedClient}
          foodsMap={foodsMap}
          settings={settings}
          onUpdatePlanMeta={(recs, comms) => {
            setTrainerRecs(recs);
            setTrainerComments(comms);
            onSavePlan({
              ...buildPlanObject(),
              trainerRecommendations: recs,
              trainerComments: comms,
            });
          }}
          onClose={() => setIsPdfOpen(false)}
        />
      ) : null}

      {/* Replace Meal Modal */}
      {replacingMealTarget && selectedClient ? (
        <ReplaceMealModal
          targetCalories={replacingMealTarget.currentCalories}
          allowedFoods={allowedFoods}
          foodsMap={foodsMap}
          onClose={() => setReplacingMealTarget(null)}
          onSelectMeal={(newMeal) => {
            updateDayAt(replacingMealTarget.dayIdx, (d) => ({
              ...d,
              meals: d.meals.map((m) =>
                m.id === replacingMealTarget.mealId
                  ? { ...newMeal, id: m.id }
                  : m
              ),
            }));
            setReplacingMealTarget(null);
          }}
        />
      ) : null}
    </div>
  );
};

interface ReplaceMealModalProps {
  targetCalories: number;
  allowedFoods: FoodItem[];
  foodsMap: Map<string, FoodItem>;
  onClose: () => void;
  onSelectMeal: (meal: Meal) => void;
}

const MEAL_TEMPLATES: {
  name: string;
  instructions: string;
  items: { foodId: string; grams: number }[];
}[] = [
  {
    name: "Яичница/омлет с цельнозерновым хлебом и овощами",
    instructions: "Приготовьте яйца на антипригарной сковороде, подавайте с хлебом и свежим огурцом.",
    items: [
      { foodId: "egg_chicken_raw", grams: 165 },
      { foodId: "bread_wholegrain", grams: 60 },
      { foodId: "cucumber_raw", grams: 100 },
    ],
  },
  {
    name: "Овсяная каша с творогом и ягодами",
    instructions: "Сварите овсянку, добавьте творог и свежие или размороженные ягоды.",
    items: [
      { foodId: "oatmeal_boiled", grams: 220 },
      { foodId: "cottage_cheese_5", grams: 120 },
      { foodId: "berries_mix_fresh", grams: 80 },
    ],
  },
  {
    name: "Куриная грудка с гречкой и салатом",
    instructions: "Подавайте запечённое филе с варёной гречкой, свежим помидором и оливковым маслом.",
    items: [
      { foodId: "chicken_breast_baked", grams: 140 },
      { foodId: "buckwheat_boiled", grams: 180 },
      { foodId: "tomato_raw", grams: 120 },
      { foodId: "olive_oil", grams: 7 },
    ],
  },
  {
    name: "Индейка с рисом и брокколи",
    instructions: "Филе индейки с отварным рисом и брокколи на пару.",
    items: [
      { foodId: "turkey_fillet_baked", grams: 140 },
      { foodId: "rice_white_boiled", grams: 170 },
      { foodId: "broccoli_boiled", grams: 130 },
      { foodId: "olive_oil", grams: 7 },
    ],
  },
  {
    name: "Запечённый лосось с картофелем и овощами",
    instructions: "Запеките рыбу в фольге, подавайте с отварным картофелем и свежими овощами.",
    items: [
      { foodId: "salmon_baked", grams: 130 },
      { foodId: "potato_boiled", grams: 180 },
      { foodId: "cucumber_raw", grams: 120 },
    ],
  },
  {
    name: "Творог с бананом и миндалём",
    instructions: "Смешайте творог со ломтиками банана и измельчённым миндалём.",
    items: [
      { foodId: "cottage_cheese_5", grams: 180 },
      { foodId: "banana_peeled", grams: 120 },
      { foodId: "almonds_raw", grams: 15 },
    ],
  },
  {
    name: "Чечевица с томатной пастой и овощами (без мяса)",
    instructions: "Прогрейте варёную чечевицу с томатной пастой и подавайте со свежими овощами.",
    items: [
      { foodId: "lentils_boiled", grams: 220 },
      { foodId: "tomato_paste", grams: 25 },
      { foodId: "bell_pepper_raw", grams: 120 },
      { foodId: "olive_oil", grams: 10 },
    ],
  },
];

const ReplaceMealModal: React.FC<ReplaceMealModalProps> = ({
  targetCalories,
  allowedFoods,
  foodsMap,
  onClose,
  onSelectMeal,
}) => {
  const allowedIds = new Set(allowedFoods.map((f) => f.id));

  const validOptions = MEAL_TEMPLATES.filter((tpl) =>
    tpl.items.every((it) => allowedIds.has(it.foodId) && foodsMap.has(it.foodId))
  ).map((tpl) => {
    const baseTotals = tpl.items.reduce(
      (sum, it) => sum + calculateIngredientMacros(foodsMap.get(it.foodId), it.grams).calories,
      0
    );
    const ratio = baseTotals > 0 ? Math.max(0.6, Math.min(1.6, targetCalories / baseTotals)) : 1;
    const scaledIngredients = tpl.items.map((it, idx) => {
      const food = foodsMap.get(it.foodId);
      let g = it.grams * ratio;
      if (food?.category === "eggs" && food.householdUnits[0]) {
        const u = food.householdUnits[0].gramsPerUnit;
        g = Math.max(1, Math.round(g / u)) * u;
      } else if (g < 25) {
        g = Math.max(3, Math.round(g));
      } else {
        g = Math.max(10, Math.round(g / 5) * 5);
      }
      return {
        id: `ing_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        foodId: it.foodId,
        grams: g,
      };
    });

    const mealObj: Meal = {
      id: `meal_${Date.now()}`,
      name: tpl.name,
      instructions: tpl.instructions,
      ingredients: scaledIngredients,
    };
    const totals = calculateMealTotals(mealObj, foodsMap);
    return { meal: mealObj, totals };
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-neutral-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Заменить приём пищи</h3>
            <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
              Варианты автоматически адаптированы под ~{targetCalories} ккал с учётом ограничений клиента.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            Закрыть
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {validOptions.length === 0 ? (
            <div className="text-sm text-neutral-500 text-center py-8">
              Нет готовых шаблонов, полностью подходящих под строгие ограничения клиента. Используйте кнопку «Добавить продукт» внутри приёма пищи.
            </div>
          ) : (
            validOptions.map(({ meal, totals }, idx) => (
              <div
                key={idx}
                className="border border-neutral-200 hover:border-emerald-600 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-semibold text-neutral-900">{meal.name}</div>
                  <div className="text-xs text-neutral-500">
                    {meal.ingredients
                      .map((i) => `${foodsMap.get(i.foodId)?.name} (${i.grams} г)`)
                      .join(", ")}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-emerald-800">
                    {totals.calories} ккал · Б {totals.protein} г · Ж {totals.fat} г · У {totals.carbs} г
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectMeal(meal)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap shrink-0"
                >
                  Выбрать
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
