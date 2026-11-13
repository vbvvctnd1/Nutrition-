import type { ActivityLevel, ClientGoal, ClientProfile, MacroTargets, Sex } from "../types/nutrition";

export interface NutritionCalculationResult {
  mifflinBmr: number;
  katchBmr: number | null;
  leanBodyMassKg: number | null;
  selectedBmr: number;
  primaryFormula: "mifflin" | "katch";
  lifestyleFactor: number;
  neatKcal: number;
  exerciseDailyKcal: number;
  tdee: number;
  dailyCalorieDelta: number;
  recommendedCalories: number;
  recommendedMacros: MacroTargets;
  warnings: string[];
  activityExplanation: string;
}

const LIFESTYLE_BASE_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.18,
  light: 1.28,
  moderate: 1.38,
  active: 1.48,
  very_active: 1.60,
};

export function calculateMifflinBmr(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

export function calculateKatchBmr(leanBodyMassKg: number): number {
  return Math.round(370 + 21.6 * leanBodyMassKg);
}

/**
 * Ensures exact 4/9/4 internal kcal consistency:
 * calories === protein * 4 + fat * 9 + carbs * 4
 */
export function computeKcalFromMacros(protein: number, fat: number, carbs: number): number {
  return Math.round(protein * 4 + fat * 9 + carbs * 4);
}

/**
 * Adjusts carbs (or proportional macros if carbs would drop too low) so total calories
 * strictly equal protein*4 + fat*9 + carbs*4.
 */
export function buildConsistentTargets(
  protein: number,
  fat: number,
  carbs: number,
  formulaUsed: "mifflin" | "katch" | "manual"
): MacroTargets {
  const p = Math.max(0, Math.round(protein));
  const f = Math.max(0, Math.round(fat));
  const c = Math.max(0, Math.round(carbs));
  return {
    protein: p,
    fat: f,
    carbs: c,
    calories: computeKcalFromMacros(p, f, c),
    formulaUsed,
  };
}

/**
 * Recalculates macros proportionally when trainer edits total daily calories directly.
 */
export function adjustMacrosForCalories(
  targetCalories: number,
  current: MacroTargets
): MacroTargets {
  const safeCal = Math.max(800, Math.round(targetCalories));
  const protein = Math.max(40, current.protein);
  const fat = Math.max(25, current.fat);
  const fixedKcal = protein * 4 + fat * 9;

  if (safeCal >= fixedKcal + 40 * 4) {
    const carbs = Math.round((safeCal - fixedKcal) / 4);
    return buildConsistentTargets(protein, fat, carbs, "manual");
  }

  // Scale all three proportionally if total calories dropped below current P+F floor
  const currentTotal = Math.max(1, computeKcalFromMacros(current.protein, current.fat, current.carbs));
  const ratio = safeCal / currentTotal;
  const newP = Math.max(30, Math.round(current.protein * ratio));
  const newF = Math.max(20, Math.round(current.fat * ratio));
  const newC = Math.max(20, Math.round((safeCal - (newP * 4 + newF * 9)) / 4));
  return buildConsistentTargets(newP, newF, newC, "manual");
}

export function calculateClientNutrition(client: ClientProfile): NutritionCalculationResult {
  const mifflinBmr = calculateMifflinBmr(
    client.sex,
    client.weightKg,
    client.heightCm,
    client.age
  );

  // Use Katch-McArdle only if explicit body composition is provided (never invent BF%)
  let leanBodyMassKg: number | null = null;
  if (typeof client.leanBodyMassKg === "number" && client.leanBodyMassKg > 20 && client.leanBodyMassKg < client.weightKg) {
    leanBodyMassKg = Number(client.leanBodyMassKg.toFixed(1));
  } else if (
    typeof client.bodyFatPercent === "number" &&
    client.bodyFatPercent >= 3 &&
    client.bodyFatPercent <= 60
  ) {
    leanBodyMassKg = Number((client.weightKg * (1 - client.bodyFatPercent / 100)).toFixed(1));
  }

  const katchBmr = leanBodyMassKg !== null ? calculateKatchBmr(leanBodyMassKg) : null;
  const primaryFormula: "mifflin" | "katch" =
    client.preferredFormula === "katch" && katchBmr !== null ? "katch" : "mifflin";
  const selectedBmr = primaryFormula === "katch" && katchBmr !== null ? katchBmr : mifflinBmr;

  // Prevent double-counting:
  // Base lifestyle factor covers baseline daily movement (sitting/standing).
  // If dailySteps is provided, compute NEAT from steps (~0.04 kcal per step * weightKg/70)
  // and blend without adding full lifestyle multiplier + full steps!
  const baseFactor = LIFESTYLE_BASE_FACTORS[client.activityLevel];
  let neatKcal: number;
  let activityExplanation: string;

  if (typeof client.dailySteps === "number" && client.dailySteps > 0) {
    // Baseline sedentary thermogenesis + TEF (~1.15 * BMR) + actual step expenditure
    const stepKcal = Math.round(client.dailySteps * 0.04 * (client.weightKg / 70));
    const baseSedentaryTdee = Math.round(selectedBmr * 1.15);
    neatKcal = baseSedentaryTdee + stepKcal;
    activityExplanation = `Базовый обмен + бытовые шаги (${client.dailySteps.toLocaleString("ru-RU")} шаг./день ≈ +${stepKcal} ккал) без двойного учёта коэффициента образа жизни.`;
  } else {
    neatKcal = Math.round(selectedBmr * baseFactor);
    activityExplanation = `Расчёт по уровню бытовой активности (×${baseFactor.toFixed(2)}) без учёта тренировок.`;
  }

  // Exercise expenditure averaged across 7 days (conservative, realistic estimate)
  const strengthDailyKcal = (Math.max(0, client.strengthFrequencyPerWeek) * 240) / 7;
  const cardioDailyKcal = (Math.max(0, client.cardioFrequencyPerWeek) * 300) / 7;
  const exerciseDailyKcal = Math.round(strengthDailyKcal + cardioDailyKcal);

  const tdee = neatKcal + exerciseDailyKcal;

  // Goal adjustment
  let dailyCalorieDelta = 0;
  const rateKg = Math.max(0, client.desiredWeeklyRateKg ?? (client.goal === "loss" ? 0.5 : client.goal === "gain" ? 0.25 : 0));

  if (client.goal === "loss") {
    // 1 kg fat ~ 7700 kcal => daily deficit = rateKg * 7700 / 7 = rateKg * 1100
    dailyCalorieDelta = -Math.round(rateKg * 1100);
  } else if (client.goal === "gain") {
    dailyCalorieDelta = Math.round(rateKg * 900);
  }

  const rawTargetCalories = tdee + dailyCalorieDelta;

  // Macro calculation based on lean body mass (or weight)
  const referenceMass = leanBodyMassKg ?? client.weightKg;
  const proteinPerKg =
    client.goal === "loss"
      ? leanBodyMassKg ? 2.2 : 1.8
      : client.goal === "gain"
        ? leanBodyMassKg ? 2.1 : 1.8
        : leanBodyMassKg ? 1.9 : 1.6;

  const proteinGrams = Math.round(referenceMass * proteinPerKg);
  const fatPerKg = client.goal === "loss" ? 0.85 : 0.95;
  const fatGrams = Math.max(Math.round(client.weightKg * 0.7), Math.round(client.weightKg * fatPerKg));

  const remainingForCarbs = Math.max(60 * 4, rawTargetCalories - (proteinGrams * 4 + fatGrams * 9));
  const carbsGrams = Math.round(remainingForCarbs / 4);

  const recommendedMacros = buildConsistentTargets(
    proteinGrams,
    fatGrams,
    carbsGrams,
    primaryFormula
  );

  const warnings: string[] = [];
  const activeCalories = client.targetOverrides ? client.targetOverrides.calories : recommendedMacros.calories;
  const minSafeCalories = client.sex === "female" ? 1200 : 1500;

  if (activeCalories < selectedBmr) {
    warnings.push(
      `Целевая калорийность (${activeCalories} ккал) ниже базового обмена веществ (${selectedBmr} ккал). Рекомендуется снизить дефицит.`
    );
  }
  if (activeCalories < minSafeCalories) {
    warnings.push(
      `Очень низкая калорийность (ниже ${minSafeCalories} ккал). Высокий риск потери мышечной массы и срывов.`
    );
  }
  if (client.goal === "loss" && (rateKg > client.weightKg * 0.01 || rateKg > 1.0)) {
    warnings.push(
      `Агрессивный темп снижения веса (${rateKg} кг/нед). Безопасным считается ориентир 0.4–1.0% от массы тела в неделю.`
    );
  }
  if (client.targetOverrides && client.targetOverrides.fat < client.weightKg * 0.6) {
    warnings.push(
      `Количество жиров (${client.targetOverrides.fat} г) ниже минимального порога (~0.6 г/кг веса), что может негативно повлиять на гормональный фон.`
    );
  }

  return {
    mifflinBmr,
    katchBmr,
    leanBodyMassKg,
    selectedBmr,
    primaryFormula,
    lifestyleFactor: baseFactor,
    neatKcal,
    exerciseDailyKcal,
    tdee,
    dailyCalorieDelta,
    recommendedCalories: recommendedMacros.calories,
    recommendedMacros,
    warnings,
    activityExplanation,
  };
}

export function getGoalDefaultRate(goal: ClientGoal): number {
  if (goal === "loss") return 0.5;
  if (goal === "gain") return 0.25;
  return 0;
}
