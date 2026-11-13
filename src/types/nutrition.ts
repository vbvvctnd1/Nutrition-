export type Sex = "male" | "female";

export type ClientGoal = "loss" | "gain" | "maintenance";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type WillingnessToChange = "minimal" | "moderate" | "flexible";

export type FoodCategory =
  | "meat"
  | "poultry"
  | "fish"
  | "seafood"
  | "eggs"
  | "dairy"
  | "grains"
  | "pasta"
  | "legumes"
  | "vegetables"
  | "fruits"
  | "bakery"
  | "oils"
  | "nuts"
  | "sweets"
  | "sauces"
  | "ready_meals"
  | "sports_nutrition"
  | "branded";

export type PreparationState =
  | "raw"
  | "dry"
  | "boiled"
  | "fried"
  | "baked"
  | "steamed"
  | "stewed"
  | "ready";

export type VerificationStatus = "verified" | "custom" | "ai_pending";

export interface HouseholdUnit {
  unitName: string; // e.g., "ст. ложка", "ч. ложка", "шт", "ломтик", "порция с ладонь"
  gramsPerUnit: number;
  unitPluralForms?: [string, string, string]; // 1, 2-4, 5+ in Russian
}

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  category: FoodCategory;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  preparationState: PreparationState;
  verificationStatus: VerificationStatus;
  source?: string;
  householdUnits: HouseholdUnit[];
  allergenTags?: string[]; // e.g., ["молоко", "глютен", "яйца", "орехи", "рыба", "морепродукты", "соя"]
}

export interface ParsedHabitItem {
  id: string;
  mentionedName: string;
  matchedFoodId: string | null;
  quantitySpecified: boolean;
  statedQuantityText: string | null;
  estimatedGrams: number | null;
  confidence: "high" | "medium" | "low";
  confirmed: boolean;
}

export interface ParsedHabitMeal {
  id: string;
  mealName: string;
  items: ParsedHabitItem[];
}

export interface MacroTargets {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  formulaUsed: "mifflin" | "katch" | "manual";
}

export interface ClientProfile {
  id: string;
  fullName: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number;
  leanBodyMassKg?: number;
  goal: ClientGoal;
  desiredWeeklyRateKg?: number; // positive number, e.g. 0.4 kg/week
  occupation: string;
  activityLevel: ActivityLevel;
  dailySteps?: number;
  strengthFrequencyPerWeek: number;
  cardioFrequencyPerWeek: number;
  mealsPerDay: number;
  favoriteFoodIds: string[];
  dislikedFoodIds: string[];
  regularFoodIds: string[];
  allergies: string[];
  restrictions: string[];
  refusedFoods: string[];
  willingnessToChange: WillingnessToChange;
  habitDescription: string;
  parsedHabits: ParsedHabitMeal[];
  habitSummary?: string;
  preferredFormula: "mifflin" | "katch";
  targetOverrides?: MacroTargets;
  questionnaireCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface MealIngredient {
  id: string;
  foodId: string;
  grams: number;
}

export interface Meal {
  id: string;
  name: string;
  instructions?: string;
  isBatchPrepped?: boolean;
  batchNote?: string;
  ingredients: MealIngredient[];
}

export interface DayPlan {
  dayNumber: number;
  dayLabel: string;
  approved: boolean;
  meals: Meal[];
}

export type PlanDurationType = "weekly" | "monthly";
export type VarietyMode = "moderate" | "batch";
export type PdfDisplayFormat = "grams" | "both" | "household";

export interface NutritionPlan {
  id: string;
  clientId: string;
  title: string;
  durationType: PlanDurationType;
  varietyMode: VarietyMode;
  targets: MacroTargets;
  days: DayPlan[];
  trainerRecommendations: string;
  trainerComments: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainerSettings {
  trainerName: string;
  brandTitle: string;
  contactInfo: string;
  logoDataUrl?: string;
  defaultPdfFormat: PdfDisplayFormat;
  defaultRecommendations: string;
}

export type AppRoute =
  | "dashboard"
  | "clients"
  | "planner"
  | "foods"
  | "settings";

export interface AppBackupPayload {
  version: 1;
  exportedAt: string;
  clients: ClientProfile[];
  foods: FoodItem[];
  plans: NutritionPlan[];
  settings: TrainerSettings;
}
