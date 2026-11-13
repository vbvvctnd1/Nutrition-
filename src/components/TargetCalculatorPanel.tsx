import React, { useMemo } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import type { ClientProfile, MacroTargets } from "../types/nutrition";
import {
  adjustMacrosForCalories,
  buildConsistentTargets,
  calculateClientNutrition,
} from "../utils/calculations";

interface TargetCalculatorPanelProps {
  client: ClientProfile;
  onUpdateClient: (updated: ClientProfile) => void;
}

export const TargetCalculatorPanel: React.FC<TargetCalculatorPanelProps> = ({
  client,
  onUpdateClient,
}) => {
  const calc = useMemo(() => calculateClientNutrition(client), [client]);
  const activeTargets: MacroTargets = client.targetOverrides || calc.recommendedMacros;
  const isManual = Boolean(client.targetOverrides);

  const handleFormulaChange = (formula: "mifflin" | "katch") => {
    onUpdateClient({
      ...client,
      preferredFormula: formula,
      targetOverrides: undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCaloriesChange = (valueStr: string) => {
    const val = Number(valueStr);
    if (!Number.isFinite(val)) return;
    const adjusted = adjustMacrosForCalories(val, activeTargets);
    onUpdateClient({
      ...client,
      targetOverrides: adjusted,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleMacroChange = (field: "protein" | "fat" | "carbs", valueStr: string) => {
    const val = Math.max(0, Number(valueStr) || 0);
    const next = {
      protein: field === "protein" ? val : activeTargets.protein,
      fat: field === "fat" ? val : activeTargets.fat,
      carbs: field === "carbs" ? val : activeTargets.carbs,
    };
    const consistent = buildConsistentTargets(next.protein, next.fat, next.carbs, "manual");
    onUpdateClient({
      ...client,
      targetOverrides: consistent,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleResetToRecommended = () => {
    onUpdateClient({
      ...client,
      targetOverrides: undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const totalKcal = Math.max(1, activeTargets.calories);
  const proteinPct = Math.round(((activeTargets.protein * 4) / totalKcal) * 100);
  const fatPct = Math.round(((activeTargets.fat * 9) / totalKcal) * 100);
  const carbsPct = Math.max(0, 100 - proteinPct - fatPct);

  return (
    <div className="space-y-6">
      {/* Formulas comparison */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              Расчёт базового обмена и расхода энергии
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Программный расчёт по физиологическим формулам без участия ИИ.
            </p>
          </div>
          {calc.katchBmr !== null ? (
            <div className="inline-flex items-center p-1 bg-neutral-100 rounded-lg self-start">
              <button
                type="button"
                onClick={() => handleFormulaChange("mifflin")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  calc.primaryFormula === "mifflin"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                Миффлин–Сан Жеор
              </button>
              <button
                type="button"
                onClick={() => handleFormulaChange("katch")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  calc.primaryFormula === "katch"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                Кэтч–МакАрдл
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-neutral-100">
          <div>
            <div className="text-xs text-neutral-500">BMR (Миффлин–Сан Жеор)</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-neutral-900">
              {calc.mifflinBmr} <span className="text-xs font-normal text-neutral-500">ккал</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">BMR (Кэтч–МакАрдл)</div>
            {calc.katchBmr !== null ? (
              <div className="mt-1 text-lg font-bold tabular-nums text-neutral-900">
                {calc.katchBmr} <span className="text-xs font-normal text-neutral-500">ккал (LBM {calc.leanBodyMassKg} кг)</span>
              </div>
            ) : (
              <div className="mt-1 text-xs text-neutral-400">
                Укажите % жира или сухую массу в анкете
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-neutral-500">TDEE (общий расход)</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-neutral-900">
              {calc.tdee} <span className="text-xs font-normal text-neutral-500">ккал</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Поправка цели</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-neutral-900">
              {calc.dailyCalorieDelta > 0 ? `+${calc.dailyCalorieDelta}` : calc.dailyCalorieDelta}{" "}
              <span className="text-xs font-normal text-neutral-500">ккал/день</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-neutral-600 bg-neutral-50 rounded-lg px-3.5 py-2.5 border border-neutral-100">
          {calc.activityExplanation}{" "}
          Тренировочный расход в среднем по неделе: +{calc.exerciseDailyKcal} ккал/день.
        </div>
      </div>

      {/* Warnings */}
      {calc.warnings.length > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
          {calc.warnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Editable Daily Targets */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              Целевые показатели КБЖУ на день
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Белки = 4 ккал/г · Жиры = 9 ккал/г · Углеводы = 4 ккал/г. Значения пересчитываются согласованно.
            </p>
          </div>
          {isManual ? (
            <button
              type="button"
              onClick={handleResetToRecommended}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 self-start whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить к расчётным ({calc.recommendedCalories} ккал)</span>
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Калории (ккал)</span>
            <input
              type="number"
              min={800}
              max={6000}
              step={10}
              value={activeTargets.calories}
              onChange={(e) => handleCaloriesChange(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base font-semibold tabular-nums text-neutral-900 focus:border-emerald-600 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-600">
              Белки (г) · {proteinPct}%
            </span>
            <input
              type="number"
              min={0}
              max={400}
              value={activeTargets.protein}
              onChange={(e) => handleMacroChange("protein", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base font-semibold tabular-nums text-neutral-900 focus:border-emerald-600 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-600">
              Жиры (г) · {fatPct}%
            </span>
            <input
              type="number"
              min={0}
              max={250}
              value={activeTargets.fat}
              onChange={(e) => handleMacroChange("fat", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base font-semibold tabular-nums text-neutral-900 focus:border-emerald-600 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-600">
              Углеводы (г) · {carbsPct}%
            </span>
            <input
              type="number"
              min={0}
              max={800}
              value={activeTargets.carbs}
              onChange={(e) => handleMacroChange("carbs", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base font-semibold tabular-nums text-neutral-900 focus:border-emerald-600 focus:outline-none"
            />
          </label>
        </div>

        {/* Visual macro proportion bar */}
        <div className="space-y-2">
          <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-neutral-100">
            <div
              style={{ width: `${proteinPct}%` }}
              className="bg-emerald-600 h-full"
              title={`Белки: ${proteinPct}%`}
            />
            <div
              style={{ width: `${fatPct}%` }}
              className="bg-amber-500 h-full"
              title={`Жиры: ${fatPct}%`}
            />
            <div
              style={{ width: `${carbsPct}%` }}
              className="bg-sky-600 h-full"
              title={`Углеводы: ${carbsPct}%`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-600 tabular-nums">
            <span>Белки: {activeTargets.protein} г ({activeTargets.protein * 4} ккал, {(activeTargets.protein / Math.max(1, client.weightKg)).toFixed(1)} г/кг)</span>
            <span>Жиры: {activeTargets.fat} г ({activeTargets.fat * 9} ккал, {(activeTargets.fat / Math.max(1, client.weightKg)).toFixed(1)} г/кг)</span>
            <span>Углеводы: {activeTargets.carbs} г ({activeTargets.carbs * 4} ккал, {(activeTargets.carbs / Math.max(1, client.weightKg)).toFixed(1)} г/кг)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
