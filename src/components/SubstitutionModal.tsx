import React, { useMemo, useState } from "react";
import { X, ArrowRight, Search } from "lucide-react";
import type { ClientProfile, FoodItem } from "../types/nutrition";
import { FOOD_CATEGORY_LABELS, PREPARATION_STATE_LABELS } from "../data/labels";
import {
  calculateIngredientMacros,
  findSubstitutions,
  formatHouseholdMeasurement,
} from "../utils/mealMath";

interface SubstitutionModalProps {
  originalFood: FoodItem;
  originalGrams: number;
  allFoods: FoodItem[];
  client: ClientProfile;
  onClose: () => void;
  onConfirmReplacement: (newFoodId: string, newGrams: number) => void;
}

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({
  originalFood,
  originalGrams,
  allFoods,
  client,
  onClose,
  onConfirmReplacement,
}) => {
  const [search, setSearch] = useState("");
  const currentMacros = useMemo(
    () => calculateIngredientMacros(originalFood, originalGrams),
    [originalFood, originalGrams]
  );

  const candidates = useMemo(() => {
    const base = findSubstitutions(originalFood, originalGrams, allFoods, client);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => c.food.name.toLowerCase().includes(q));
  }, [originalFood, originalGrams, allFoods, client, search]);

  const formatDiff = (val: number, unit: string) => {
    if (val === 0) return `0 ${unit}`;
    return `${val > 0 ? "+" : ""}${val} ${unit}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-neutral-200 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Заменить продукт</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Аллергены, нелюбимые продукты и ограничения клиента исключены автоматически.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-1.5 text-neutral-400 hover:text-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs text-neutral-500">Заменяемый продукт</div>
            <div className="text-sm font-semibold text-neutral-900">
              {originalFood.name} · {Math.round(originalGrams)} г
            </div>
          </div>
          <div className="text-xs font-mono tabular-nums text-neutral-700">
            {currentMacros.calories} ккал · Б {currentMacros.protein} · Ж {currentMacros.fat} · У {currentMacros.carbs}
          </div>
        </div>

        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск среди подходящих замен..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {candidates.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-500">
              Подходящих эквивалентных замен с учётом ограничений клиента не найдено.
            </div>
          ) : (
            candidates.map((cand) => {
              const household = formatHouseholdMeasurement(cand.food, cand.suggestedGrams);
              return (
                <div
                  key={cand.food.id}
                  className="border border-neutral-200 hover:border-emerald-600 rounded-lg p-3.5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {cand.food.name}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {FOOD_CATEGORY_LABELS[cand.food.category]} · {PREPARATION_STATE_LABELS[cand.food.preparationState]}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-700 tabular-nums">
                      <span className="font-semibold text-emerald-800">
                        {cand.suggestedGrams} г{household ? ` (${household})` : ""}
                      </span>{" "}
                      <span className="text-neutral-400">·</span>{" "}
                      <span>
                        {cand.replacementMacros.calories} ккал (Б {cand.replacementMacros.protein} / Ж {cand.replacementMacros.fat} / У {cand.replacementMacros.carbs})
                      </span>
                    </div>

                    <div className="text-[11px] font-mono tabular-nums text-neutral-500">
                      {cand.reason} · Разница: {formatDiff(cand.diff.calories, "ккал")} · Б {formatDiff(cand.diff.protein, "г")} · Ж {formatDiff(cand.diff.fat, "г")} · У {formatDiff(cand.diff.carbs, "г")}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onConfirmReplacement(cand.food.id, cand.suggestedGrams)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap shrink-0"
                  >
                    <span>Выбрать</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
