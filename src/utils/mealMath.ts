import type {
  ClientProfile,
  DayPlan,
  FoodItem,
  MacroTargets,
  Meal,
  MealIngredient,
} from "../types/nutrition";

export interface MacroTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface SubstitutionCandidate {
  food: FoodItem;
  suggestedGrams: number;
  currentMacros: MacroTotals;
  replacementMacros: MacroTotals;
  diff: MacroTotals;
  matchScore: number;
  reason: string;
}

export function calculateIngredientMacros(food: FoodItem | undefined, grams: number): MacroTotals {
  if (!food || grams <= 0) {
    return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  }
  const factor = grams / 100;
  return {
    calories: Math.round(food.caloriesPer100g * factor),
    protein: Number((food.proteinPer100g * factor).toFixed(1)),
    fat: Number((food.fatPer100g * factor).toFixed(1)),
    carbs: Number((food.carbsPer100g * factor).toFixed(1)),
  };
}

export function calculateMealTotals(meal: Meal, foodsMap: Map<string, FoodItem>): MacroTotals {
  const sum = meal.ingredients.reduce(
    (acc, ing) => {
      const m = calculateIngredientMacros(foodsMap.get(ing.foodId), ing.grams);
      return {
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        fat: acc.fat + m.fat,
        carbs: acc.carbs + m.carbs,
      };
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
  return {
    calories: Math.round(sum.calories),
    protein: Number(sum.protein.toFixed(1)),
    fat: Number(sum.fat.toFixed(1)),
    carbs: Number(sum.carbs.toFixed(1)),
  };
}

export function calculateDayTotals(day: DayPlan, foodsMap: Map<string, FoodItem>): MacroTotals {
  const sum = day.meals.reduce(
    (acc, meal) => {
      const m = calculateMealTotals(meal, foodsMap);
      return {
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        fat: acc.fat + m.fat,
        carbs: acc.carbs + m.carbs,
      };
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
  return {
    calories: Math.round(sum.calories),
    protein: Number(sum.protein.toFixed(1)),
    fat: Number(sum.fat.toFixed(1)),
    carbs: Number(sum.carbs.toFixed(1)),
  };
}

function pluralizeRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  if (!Number.isInteger(abs)) {
    return forms[1]; // e.g., 1.5 ложки, 2.5 яйца
  }
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/**
 * Formats food-specific household measurement if reliable conversion exists.
 * Returns null if no conversion is available (grams only should be shown).
 */
export function formatHouseholdMeasurement(food: FoodItem | undefined, grams: number): string | null {
  if (!food || !food.householdUnits || food.householdUnits.length === 0 || grams <= 0) {
    return null;
  }

  // Pick the most practical unit whose count falls nicely between 0.5 and 12
  let chosen = food.householdUnits[0];
  for (const unit of food.householdUnits) {
    const count = grams / unit.gramsPerUnit;
    if (count >= 0.7 && count <= 8) {
      chosen = unit;
      break;
    }
  }

  const rawCount = grams / chosen.gramsPerUnit;
  // Round to nearest 0.5 for practical kitchen use
  const rounded = Math.max(0.5, Math.round(rawCount * 2) / 2);
  const formattedNumber = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  const label = chosen.unitPluralForms
    ? pluralizeRu(rounded, chosen.unitPluralForms)
    : chosen.unitName;

  return `≈ ${formattedNumber} ${label}`;
}

export function isFoodAllowedForClient(food: FoodItem, client: ClientProfile): boolean {
  if (food.verificationStatus === "ai_pending") return false;
  if (client.dislikedFoodIds.includes(food.id)) return false;

  const lowerName = food.name.toLowerCase();
  for (const refused of client.refusedFoods) {
    if (refused.trim() && lowerName.includes(refused.trim().toLowerCase())) {
      return false;
    }
  }

  // Allergen check
  const foodAllergens = (food.allergenTags || []).map((a) => a.toLowerCase());
  for (const clientAllergy of client.allergies) {
    const ca = clientAllergy.toLowerCase();
    if (foodAllergens.some((fa) => fa.includes(ca) || ca.includes(fa))) {
      return false;
    }
    if (ca.includes("лактоз") || ca.includes("молок")) {
      if (food.category === "dairy" || foodAllergens.some((fa) => fa.includes("молок"))) {
        return false;
      }
    }
    if (ca.includes("глютен") && foodAllergens.some((fa) => fa.includes("глютен"))) {
      return false;
    }
    if (ca.includes("яйц") && (food.category === "eggs" || foodAllergens.some((fa) => fa.includes("яйц")))) {
      return false;
    }
    if (ca.includes("рыб") && (food.category === "fish" || foodAllergens.some((fa) => fa.includes("рыб")))) {
      return false;
    }
    if (ca.includes("морепродукт") && (food.category === "seafood" || foodAllergens.some((fa) => fa.includes("морепродукт")))) {
      return false;
    }
    if (ca.includes("орех") && (food.category === "nuts" || foodAllergens.some((fa) => fa.includes("орех")))) {
      return false;
    }
  }

  // Dietary restrictions check
  for (const rest of client.restrictions) {
    const r = rest.toLowerCase();
    if (r.includes("без свинин") && lowerName.includes("свин")) return false;
    if (r.includes("без говядин") && lowerName.includes("говяд")) return false;
    if (r.includes("вегетариан") && ["meat", "poultry", "fish", "seafood"].includes(food.category)) return false;
    if (r.includes("пескетариан") && ["meat", "poultry"].includes(food.category)) return false;
    if (r.includes("без лактоз") && (food.category === "dairy" || foodAllergens.some((fa) => fa.includes("молок")))) return false;
    if (r.includes("без глютен") && foodAllergens.some((fa) => fa.includes("глютен"))) return false;
  }

  return true;
}

/**
 * Finds verified food replacements in the database, automatically computing equivalent grams
 * (by dominant macro or calories) and excluding allergens / restrictions / disliked items.
 */
export function findSubstitutions(
  originalFood: FoodItem,
  originalGrams: number,
  allFoods: FoodItem[],
  client: ClientProfile
): SubstitutionCandidate[] {
  const currentMacros = calculateIngredientMacros(originalFood, originalGrams);

  // Determine dominant nutrient role of original food
  const pShare = (originalFood.proteinPer100g * 4) / Math.max(1, originalFood.caloriesPer100g);
  const fShare = (originalFood.fatPer100g * 9) / Math.max(1, originalFood.caloriesPer100g);
  const cShare = (originalFood.carbsPer100g * 4) / Math.max(1, originalFood.caloriesPer100g);

  let mode: "protein" | "fat" | "carbs" | "calories" = "calories";
  if (pShare >= 0.45) mode = "protein";
  else if (fShare >= 0.55) mode = "fat";
  else if (cShare >= 0.55) mode = "carbs";

  const candidates: SubstitutionCandidate[] = [];

  for (const candidate of allFoods) {
    if (candidate.id === originalFood.id) continue;
    if (!isFoodAllowedForClient(candidate, client)) continue;
    if (candidate.caloriesPer100g <= 0) continue;

    // Filter to reasonably compatible category or macro role
    const sameCategory = candidate.category === originalFood.category;
    const candPShare = (candidate.proteinPer100g * 4) / Math.max(1, candidate.caloriesPer100g);
    const candFShare = (candidate.fatPer100g * 9) / Math.max(1, candidate.caloriesPer100g);
    const candCShare = (candidate.carbsPer100g * 4) / Math.max(1, candidate.caloriesPer100g);

    if (!sameCategory) {
      if (mode === "protein" && candPShare < 0.35) continue;
      if (mode === "fat" && candFShare < 0.45) continue;
      if (mode === "carbs" && candCShare < 0.45) continue;
    }

    // Compute equivalent gram quantity
    let rawGrams = originalGrams;
    let reason = "Эквивалент по калорийности";

    if (mode === "protein" && candidate.proteinPer100g > 2) {
      rawGrams = (currentMacros.protein / candidate.proteinPer100g) * 100;
      reason = "Эквивалент по белку";
    } else if (mode === "fat" && candidate.fatPer100g > 2) {
      rawGrams = (currentMacros.fat / candidate.fatPer100g) * 100;
      reason = "Эквивалент по жирам";
    } else if (mode === "carbs" && candidate.carbsPer100g > 2) {
      rawGrams = (currentMacros.carbs / candidate.carbsPer100g) * 100;
      reason = "Эквивалент по углеводам";
    } else {
      rawGrams = (currentMacros.calories / candidate.caloriesPer100g) * 100;
    }

    // Practical rounding (nearest 5g, or nearest 1g for oils/small items < 25g)
    const suggestedGrams =
      rawGrams < 25
        ? Math.max(2, Math.round(rawGrams))
        : Math.max(10, Math.round(rawGrams / 5) * 5);

    if (suggestedGrams > 600) continue; // Skip unrealistic portion sizes

    const replacementMacros = calculateIngredientMacros(candidate, suggestedGrams);
    const diff: MacroTotals = {
      calories: replacementMacros.calories - currentMacros.calories,
      protein: Number((replacementMacros.protein - currentMacros.protein).toFixed(1)),
      fat: Number((replacementMacros.fat - currentMacros.fat).toFixed(1)),
      carbs: Number((replacementMacros.carbs - currentMacros.carbs).toFixed(1)),
    };

    // Score closeness (lower penalty = better match)
    const calDiffRatio = Math.abs(diff.calories) / Math.max(50, currentMacros.calories);
    const macroPenalty =
      Math.abs(diff.protein) * 2 + Math.abs(diff.fat) * 2.5 + Math.abs(diff.carbs) * 1.5;
    const categoryBonus = sameCategory ? 15 : 0;
    const preferredBonus = client.favoriteFoodIds.includes(candidate.id) ? 10 : 0;
    const matchScore = Math.max(
      10,
      Math.min(99, Math.round(95 - calDiffRatio * 40 - macroPenalty * 0.6 + categoryBonus + preferredBonus))
    );

    candidates.push({
      food: candidate,
      suggestedGrams,
      currentMacros,
      replacementMacros,
      diff,
      matchScore,
      reason,
    });
  }

  return candidates.sort((a, b) => b.matchScore - a.matchScore).slice(0, 12);
}

/**
 * Programmatically scales ingredient quantities in a generated DayPlan so daily calories
 * closely align with the client's calculated target (preserving verified food values).
 */
export function scaleDayIngredientsToTarget(
  day: DayPlan,
  targets: MacroTargets,
  foodsMap: Map<string, FoodItem>
): DayPlan {
  const current = calculateDayTotals(day, foodsMap);
  if (current.calories <= 0 || targets.calories <= 0) return day;

  const ratio = targets.calories / current.calories;
  // Clamp scaling to avoid absurd portions if AI was slightly off
  const safeRatio = Math.max(0.65, Math.min(1.45, ratio));

  if (Math.abs(1 - safeRatio) < 0.03) {
    return day;
  }

  const scaledMeals: Meal[] = day.meals.map((meal) => ({
    ...meal,
    ingredients: meal.ingredients.map((ing: MealIngredient) => {
      const food = foodsMap.get(ing.foodId);
      let newGrams = ing.grams * safeRatio;

      // Smart rounding: keep oils/butter/nuts/eggs reasonable
      if (food?.category === "eggs" && food.householdUnits[0]) {
        const unitG = food.householdUnits[0].gramsPerUnit;
        const count = Math.max(1, Math.round(newGrams / unitG));
        newGrams = count * unitG;
      } else if (newGrams < 25) {
        newGrams = Math.max(3, Math.round(newGrams));
      } else {
        newGrams = Math.max(10, Math.round(newGrams / 5) * 5);
      }

      return { ...ing, grams: newGrams };
    }),
  }));

  return {
    ...day,
    meals: scaledMeals,
  };
}
