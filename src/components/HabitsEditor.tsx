import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
} from "lucide-react";
import type {
  ClientProfile,
  FoodCategory,
  FoodItem,
  ParsedHabitMeal,
} from "../types/nutrition";
import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS, PREPARATION_STATE_LABELS } from "../data/labels";
import { aiService, type HabitImprovementsResponse } from "../services/aiService";
import { calculateClientNutrition } from "../utils/calculations";

interface HabitsEditorProps {
  client: ClientProfile;
  foods: FoodItem[];
  onUpdateClient: (updated: ClientProfile) => void;
  onQueueNewFood: (name: string) => void;
}

export const HabitsEditor: React.FC<HabitsEditorProps> = ({
  client,
  foods,
  onUpdateClient,
  onQueueNewFood,
}) => {
  const [methodTab, setMethodTab] = useState<"natural" | "manual">("natural");

  // Method B: Natural language state
  const [description, setDescription] = useState(client.habitDescription || "");
  const [draftMeals, setDraftMeals] = useState<ParsedHabitMeal[]>(client.parsedHabits || []);
  const [draftSummary, setDraftSummary] = useState(client.habitSummary || "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Improvement suggestions state
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<HabitImprovementsResponse["suggestions"]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Method A: Manual food selection state
  const [manualSearch, setManualSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | "all">("all");

  const verifiedFoods = useMemo(
    () => foods.filter((f) => f.verificationStatus !== "ai_pending"),
    [foods]
  );

  const foodsByCategory = useMemo(() => {
    const query = manualSearch.trim().toLowerCase();
    const filtered = verifiedFoods.filter((f) => {
      if (selectedCategory !== "all" && f.category !== selectedCategory) return false;
      if (query && !f.name.toLowerCase().includes(query) && !(f.brand || "").toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });

    const grouped = new Map<FoodCategory, FoodItem[]>();
    for (const cat of FOOD_CATEGORIES) {
      const items = filtered.filter((f) => f.category === cat);
      if (items.length > 0) grouped.set(cat, items);
    }
    return grouped;
  }, [verifiedFoods, manualSearch, selectedCategory]);

  const toggleFoodPreference = (
    foodId: string,
    field: "regularFoodIds" | "favoriteFoodIds" | "dislikedFoodIds"
  ) => {
    const current = client[field];
    const nextList = current.includes(foodId)
      ? current.filter((id) => id !== foodId)
      : [...current, foodId];

    // If marking as favorite, ensure not disliked and vice-versa
    let nextFavorites = field === "favoriteFoodIds" ? nextList : client.favoriteFoodIds;
    let nextDisliked = field === "dislikedFoodIds" ? nextList : client.dislikedFoodIds;
    if (field === "favoriteFoodIds" && nextList.includes(foodId)) {
      nextDisliked = nextDisliked.filter((id) => id !== foodId);
    }
    if (field === "dislikedFoodIds" && nextList.includes(foodId)) {
      nextFavorites = nextFavorites.filter((id) => id !== foodId);
    }

    onUpdateClient({
      ...client,
      regularFoodIds: field === "regularFoodIds" ? nextList : client.regularFoodIds,
      favoriteFoodIds: nextFavorites,
      dislikedFoodIds: nextDisliked,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAnalyzeWithAi = async () => {
    if (!description.trim()) {
      setAiError("Введите текстовое описание привычного рациона клиента.");
      return;
    }
    setAiError(null);
    setSaveFeedback(null);
    setIsAnalyzing(true);

    try {
      const result = await aiService.parseHabits(description, verifiedFoods);
      const mappedMeals: ParsedHabitMeal[] = (result.meals || []).map((m, mIdx) => ({
        id: `pm_${Date.now()}_${mIdx}`,
        mealName: m.mealName,
        items: (m.items || []).map((it, iIdx) => ({
          id: `pi_${Date.now()}_${mIdx}_${iIdx}`,
          mentionedName: it.mentionedName,
          matchedFoodId: it.matchedFoodId || null,
          quantitySpecified: Boolean(it.quantitySpecified),
          statedQuantityText: it.statedQuantityText || null,
          estimatedGrams:
            it.quantitySpecified && typeof it.estimatedGrams === "number"
              ? Math.round(it.estimatedGrams)
              : null,
          confidence: it.confidence || "medium",
          confirmed: false,
        })),
      }));

      setDraftMeals(mappedMeals);
      setDraftSummary(result.habitSummary || "");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Не удалось проанализировать описание.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveParsedHabits = () => {
    // Also sync matched regular foods to client.regularFoodIds if not disliked
    const matchedIds = new Set(client.regularFoodIds);
    for (const meal of draftMeals) {
      for (const item of meal.items) {
        if (item.matchedFoodId && !client.dislikedFoodIds.includes(item.matchedFoodId)) {
          matchedIds.add(item.matchedFoodId);
        }
      }
    }

    const confirmedMeals = draftMeals.map((m) => ({
      ...m,
      items: m.items.map((it) => ({ ...it, confirmed: true })),
    }));
    setDraftMeals(confirmedMeals);

    onUpdateClient({
      ...client,
      habitDescription: description,
      parsedHabits: confirmedMeals,
      habitSummary: draftSummary,
      regularFoodIds: Array.from(matchedIds),
      updatedAt: new Date().toISOString(),
    });
    setSaveFeedback("Привычки и структура питания сохранены в профиль клиента.");
  };

  const handleUpdateDraftItem = (
    mealId: string,
    itemId: string,
    patch: Partial<ParsedHabitMeal["items"][number]>
  ) => {
    setDraftMeals((prev) =>
      prev.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: m.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
            }
          : m
      )
    );
  };

  const handleRemoveDraftItem = (mealId: string, itemId: string) => {
    setDraftMeals((prev) =>
      prev.map((m) =>
        m.id === mealId ? { ...m, items: m.items.filter((it) => it.id !== itemId) } : m
      )
    );
  };

  const handleAddDraftItem = (mealId: string) => {
    setDraftMeals((prev) =>
      prev.map((m) =>
        m.id === mealId
          ? {
              ...m,
              items: [
                ...m.items,
                {
                  id: `pi_${Date.now()}`,
                  mentionedName: "Новый продукт",
                  matchedFoodId: verifiedFoods[0]?.id || null,
                  quantitySpecified: true,
                  statedQuantityText: "100 г",
                  estimatedGrams: 100,
                  confidence: "high",
                  confirmed: false,
                },
              ],
            }
          : m
      )
    );
  };

  const handleSuggestImprovements = async () => {
    setIsSuggesting(true);
    setSuggestError(null);
    try {
      const calc = calculateClientNutrition(client);
      const targets = client.targetOverrides || calc.recommendedMacros;
      const res = await aiService.suggestHabitImprovements(client, targets);
      setSuggestions(res.suggestions || []);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Ошибка при получении рекомендаций.");
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Method Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-neutral-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setMethodTab("natural")}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              methodTab === "natural"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Текстовый разбор с ИИ (Метод Б)
          </button>
          <button
            type="button"
            onClick={() => setMethodTab("manual")}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              methodTab === "manual"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Ручной выбор из базы (Метод А)
          </button>
        </div>

        <div className="text-xs text-neutral-500 tabular-nums">
          Выбрано: обычных {client.regularFoodIds.length} · любимых {client.favoriteFoodIds.length} · нелюбимых {client.dislikedFoodIds.length}
        </div>
      </div>

      {methodTab === "natural" ? (
        <div className="space-y-5">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Опишите привычный рацион клиента своими словами
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                ИИ определит приёмы пищи, сопоставит продукты с проверенной базой и выделит указанные количества. Отсутствующие граммовки не выдумываются — вы уточните их перед сохранением.
              </p>
            </div>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Например: На завтрак клиент обычно ест 3 яйца и 2 ломтика хлеба. На обед курицу с рисом. Вечером творог и банан."
              className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm leading-relaxed focus:border-emerald-600 focus:outline-none"
            />

            {aiError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-red-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{aiError}</span>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeWithAi}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-medium text-red-800 hover:bg-red-100 self-start sm:self-center whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Повторить</span>
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleAnalyzeWithAi}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAnalyzing ? "Анализируем описание..." : "Распознать привычки с ИИ"}</span>
              </button>

              {draftMeals.length > 0 ? (
                <button
                  type="button"
                  onClick={handleSaveParsedHabits}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-sm font-medium transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Подтвердить и сохранить в профиль</span>
                </button>
              ) : null}
            </div>

            {saveFeedback ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-medium text-emerald-900">
                {saveFeedback}
              </div>
            ) : null}
          </div>

          {/* Review and Edit Recognized Habits */}
          {draftMeals.length > 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">
                  Проверка распознанных приёмов пищи (отредактируйте перед сохранением)
                </h4>
              </div>

              {draftSummary ? (
                <label className="block">
                  <span className="text-xs font-medium text-neutral-600">Резюме привычек</span>
                  <input
                    type="text"
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </label>
              ) : null}

              <div className="space-y-4">
                {draftMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="border border-neutral-200 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <input
                        type="text"
                        value={meal.mealName}
                        onChange={(e) =>
                          setDraftMeals((prev) =>
                            prev.map((m) => (m.id === meal.id ? { ...m, mealName: e.target.value } : m))
                          )
                        }
                        className="font-semibold text-sm text-neutral-900 border-b border-transparent focus:border-emerald-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddDraftItem(meal.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить продукт</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {meal.items.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center py-2 border-t border-neutral-100 first:border-t-0"
                        >
                          <div className="md:col-span-3">
                            <div className="text-[11px] text-neutral-400">В тексте</div>
                            <input
                              type="text"
                              value={item.mentionedName}
                              onChange={(e) =>
                                handleUpdateDraftItem(meal.id, item.id, {
                                  mentionedName: e.target.value,
                                })
                              }
                              className="w-full text-xs text-neutral-800 border border-neutral-200 rounded px-2 py-1.5"
                            />
                          </div>

                          <div className="md:col-span-5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-neutral-400">Продукт из базы</span>
                              {!item.matchedFoodId && item.mentionedName.trim() ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onQueueNewFood(item.mentionedName);
                                    setSaveFeedback(`Продукт «${item.mentionedName}» добавлен в Базу продуктов (вкладка «На проверке»).`);
                                  }}
                                  className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
                                >
                                  + В список на проверку
                                </button>
                              ) : null}
                            </div>
                            <select
                              value={item.matchedFoodId || ""}
                              onChange={(e) =>
                                handleUpdateDraftItem(meal.id, item.id, {
                                  matchedFoodId: e.target.value || null,
                                })
                              }
                              className={`w-full text-xs border rounded px-2 py-1.5 bg-white ${
                                item.matchedFoodId
                                  ? "border-neutral-200 text-neutral-900"
                                  : "border-amber-300 bg-amber-50 text-amber-900"
                              }`}
                            >
                              <option value="">— Не сопоставлено (выберите из базы) —</option>
                              {verifiedFoods.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name} ({PREPARATION_STATE_LABELS[f.preparationState]})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <div className="text-[11px] text-neutral-400">
                              {item.quantitySpecified
                                ? `Граммы (${item.statedQuantityText || "указано"})`
                                : "Кол-во не указано (уточните)"}
                            </div>
                            <input
                              type="number"
                              min={0}
                              placeholder="Укажите граммы"
                              value={item.estimatedGrams ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                handleUpdateDraftItem(meal.id, item.id, {
                                  estimatedGrams: v ? Number(v) : null,
                                  quantitySpecified: Boolean(v),
                                });
                              }}
                              className={`w-full text-xs tabular-nums border rounded px-2 py-1.5 ${
                                item.estimatedGrams === null
                                  ? "border-amber-300 bg-amber-50"
                                  : "border-neutral-200"
                              }`}
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftItem(meal.id, item.id)}
                              aria-label="Удалить позицию"
                              className="p-1.5 text-neutral-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Practical AI suggestions for adapting habits */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-neutral-900">
                  Практические идеи корректировки привычек
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Мягкие улучшения текущего рациона клиента без резкого отказа от привычных блюд.
                </p>
              </div>
              <button
                type="button"
                disabled={isSuggesting}
                onClick={handleSuggestImprovements}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-800 whitespace-nowrap self-start"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isSuggesting ? "Подбираем советы..." : "Предложить корректировки"}</span>
              </button>
            </div>

            {suggestError ? (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {suggestError}
              </div>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                {suggestions.map((s, idx) => (
                  <div key={idx} className="py-3 space-y-1">
                    <div className="text-sm font-semibold text-neutral-900">{s.title}</div>
                    <div className="text-xs text-neutral-800">{s.action}</div>
                    <div className="text-xs text-neutral-500">{s.rationale}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* Method A: Manual Food Selection */
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Поиск продукта..."
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as FoodCategory | "all")}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">Все категории ({verifiedFoods.length})</option>
              {FOOD_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {FOOD_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-5 max-h-[540px] overflow-y-auto pr-1">
            {Array.from(foodsByCategory.entries()).map(([category, items]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  {FOOD_CATEGORY_LABELS[category]}
                </h4>
                <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg">
                  {items.map((food) => {
                    const isRegular = client.regularFoodIds.includes(food.id);
                    const isFavorite = client.favoriteFoodIds.includes(food.id);
                    const isDisliked = client.dislikedFoodIds.includes(food.id);

                    return (
                      <div
                        key={food.id}
                        className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-neutral-900 truncate">
                            {food.name}
                          </div>
                          <div className="text-xs text-neutral-500 tabular-nums">
                            {PREPARATION_STATE_LABELS[food.preparationState]} · {food.caloriesPer100g} ккал · Б {food.proteinPer100g} / Ж {food.fatPer100g} / У {food.carbsPer100g}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleFoodPreference(food.id, "regularFoodIds")}
                            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
                              isRegular
                                ? "bg-sky-50 border-sky-300 text-sky-900"
                                : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            Ест регулярно
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFoodPreference(food.id, "favoriteFoodIds")}
                            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
                              isFavorite
                                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                                : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            Любит
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFoodPreference(food.id, "dislikedFoodIds")}
                            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
                              isDisliked
                                ? "bg-red-50 border-red-300 text-red-900"
                                : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            Не любит
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
