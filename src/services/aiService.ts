import type {
  ClientProfile,
  DayPlan,
  FoodItem,
  MacroTargets,
  VarietyMode,
} from "../types/nutrition";
import { GOAL_LABELS, PREPARATION_STATE_LABELS, WILLINGNESS_LABELS } from "../data/labels";
import { isFoodAllowedForClient } from "../utils/mealMath";

export interface GeminiStatusResponse {
  configured: boolean;
  model: string;
}

export interface ParsedHabitsAiResponse {
  meals: {
    mealName: string;
    items: {
      mentionedName: string;
      matchedFoodId: string | null;
      quantitySpecified: boolean;
      statedQuantityText: string | null;
      estimatedGrams: number | null;
      confidence: "high" | "medium" | "low";
    }[];
  }[];
  habitSummary: string;
}

export interface HabitImprovementsResponse {
  suggestions: {
    title: string;
    action: string;
    rationale: string;
  }[];
}

export interface GeneratedMealRaw {
  name: string;
  instructions?: string;
  isBatchPrepped?: boolean;
  batchNote?: string | null;
  ingredients: {
    foodId: string;
    grams: number;
  }[];
}

export interface GenerateDayResponse {
  meals: GeneratedMealRaw[];
  rationale?: string;
}

export interface GenerateWeekResponse {
  days: {
    dayNumber: number;
    meals: GeneratedMealRaw[];
  }[];
}

function buildCompactCatalog(foods: FoodItem[], client?: ClientProfile) {
  return foods
    .filter((f) => (client ? isFoodAllowedForClient(f, client) : f.verificationStatus !== "ai_pending"))
    .map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      state: PREPARATION_STATE_LABELS[f.preparationState],
      kcal: f.caloriesPer100g,
      p: f.proteinPer100g,
      f: f.fatPer100g,
      c: f.carbsPer100g,
    }));
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Ошибка при обращении к серверу Gemini AI.");
  }
  return data as T;
}

export const aiService = {
  async checkStatus(): Promise<GeminiStatusResponse> {
    try {
      const res = await fetch("/api/gemini/status");
      if (!res.ok) return { configured: false, model: "gemini-4-hydrogen" };
      return (await res.json()) as GeminiStatusResponse;
    } catch {
      return { configured: false, model: "gemini-4-hydrogen" };
    }
  },

  async parseHabits(description: string, foods: FoodItem[]): Promise<ParsedHabitsAiResponse> {
    return postJson<ParsedHabitsAiResponse>("/api/ai/parse-habits", {
      description,
      catalog: buildCompactCatalog(foods),
    });
  },

  async suggestHabitImprovements(
    client: ClientProfile,
    targets: MacroTargets
  ): Promise<HabitImprovementsResponse> {
    return postJson<HabitImprovementsResponse>("/api/ai/suggest-improvements", {
      goal: GOAL_LABELS[client.goal],
      targets: {
        calories: targets.calories,
        protein: targets.protein,
        fat: targets.fat,
        carbs: targets.carbs,
      },
      habitSummary: client.habitSummary || client.habitDescription || "Описание привычек не заполнено",
      willingnessToChange: WILLINGNESS_LABELS[client.willingnessToChange],
      restrictions: [...client.allergies, ...client.restrictions],
    });
  },

  async generateDay1(
    client: ClientProfile,
    targets: MacroTargets,
    varietyMode: VarietyMode,
    foods: FoodItem[]
  ): Promise<GenerateDayResponse> {
    const foodsMap = new Map(foods.map((f) => [f.id, f]));
    const favoriteFoodNames = client.favoriteFoodIds
      .map((id) => foodsMap.get(id)?.name)
      .filter((x): x is string => Boolean(x));
    const regularFoodNames = client.regularFoodIds
      .map((id) => foodsMap.get(id)?.name)
      .filter((x): x is string => Boolean(x));
    const dislikedFoodNames = client.dislikedFoodIds
      .map((id) => foodsMap.get(id)?.name)
      .filter((x): x is string => Boolean(x));

    return postJson<GenerateDayResponse>("/api/ai/generate-day", {
      goal: GOAL_LABELS[client.goal],
      targets: {
        calories: targets.calories,
        protein: targets.protein,
        fat: targets.fat,
        carbs: targets.carbs,
      },
      mealsPerDay: client.mealsPerDay,
      varietyMode,
      willingnessToChange: WILLINGNESS_LABELS[client.willingnessToChange],
      favoriteFoodNames,
      regularFoodNames,
      dislikedFoodNames: [...dislikedFoodNames, ...client.refusedFoods],
      allergies: client.allergies,
      restrictions: client.restrictions,
      habitSummary: client.habitSummary || client.habitDescription || "",
      catalog: buildCompactCatalog(foods, client),
    });
  },

  async generateRemainingDays(
    client: ClientProfile,
    approvedDay1: DayPlan,
    daysToGenerate: number,
    targets: MacroTargets,
    varietyMode: VarietyMode,
    foods: FoodItem[]
  ): Promise<GenerateWeekResponse> {
    const foodsMap = new Map(foods.map((f) => [f.id, f]));
    return postJson<GenerateWeekResponse>("/api/ai/generate-week", {
      approvedDay1: {
        meals: approvedDay1.meals.map((m) => ({
          name: m.name,
          ingredients: m.ingredients.map((i) => ({
            foodName: foodsMap.get(i.foodId)?.name || i.foodId,
            grams: i.grams,
          })),
        })),
      },
      daysToGenerate,
      targets: {
        calories: targets.calories,
        protein: targets.protein,
        fat: targets.fat,
        carbs: targets.carbs,
      },
      varietyMode,
      goal: GOAL_LABELS[client.goal],
      allergies: client.allergies,
      restrictions: [...client.restrictions, ...client.refusedFoods],
      catalog: buildCompactCatalog(foods, client),
    });
  },
};
