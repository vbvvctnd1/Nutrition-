import type {
  ActivityLevel,
  ClientGoal,
  FoodCategory,
  PdfDisplayFormat,
  PreparationState,
  VarietyMode,
  VerificationStatus,
  WillingnessToChange,
} from "../types/nutrition";

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  meat: "Мясо",
  poultry: "Птица",
  fish: "Рыба",
  seafood: "Морепродукты",
  eggs: "Яйца",
  dairy: "Молочные продукты",
  grains: "Крупы и злаки",
  pasta: "Макаронные изделия",
  legumes: "Бобовые",
  vegetables: "Овощи",
  fruits: "Фрукты и ягоды",
  bakery: "Хлеб и выпечка",
  oils: "Масла и жиры",
  nuts: "Орехи и семена",
  sweets: "Сладости",
  sauces: "Соусы",
  ready_meals: "Готовые блюда",
  sports_nutrition: "Спортивное питание",
  branded: "Брендовые продукты",
};

export const FOOD_CATEGORIES: FoodCategory[] = [
  "meat",
  "poultry",
  "fish",
  "seafood",
  "eggs",
  "dairy",
  "grains",
  "pasta",
  "legumes",
  "vegetables",
  "fruits",
  "bakery",
  "oils",
  "nuts",
  "sweets",
  "sauces",
  "ready_meals",
  "sports_nutrition",
  "branded",
];

export const PREPARATION_STATE_LABELS: Record<PreparationState, string> = {
  raw: "Сырой",
  dry: "Сухой",
  boiled: "Варёный",
  fried: "Жареный",
  baked: "Запечённый",
  steamed: "На пару",
  stewed: "Тушёный",
  ready: "Готовый к употреблению",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  verified: "Проверено",
  custom: "Добавлено тренером",
  ai_pending: "Ожидает проверки ИИ",
};

export const GOAL_LABELS: Record<ClientGoal, string> = {
  loss: "Снижение веса",
  gain: "Набор мышечной массы",
  maintenance: "Поддержание веса",
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Сидячий образ жизни (офис, минимум ходьбы)",
  light: "Лёгкая активность (прогулки, дела по дому)",
  moderate: "Умеренная активность (на ногах часть дня)",
  active: "Высокая бытовая активность (подвижная работа)",
  very_active: "Очень высокая активность (тяжёлый физический труд)",
};

export const WILLINGNESS_LABELS: Record<WillingnessToChange, string> = {
  minimal: "Минимальные изменения (сохранить привычный рацион)",
  moderate: "Умеренные изменения (готов к заменам и корректировкам)",
  flexible: "Высокая гибкость (готов к новым блюдам)",
};

export const VARIETY_MODE_LABELS: Record<VarietyMode, string> = {
  moderate: "Умеренное разнообразие",
  batch: "Заготовка на 2–3 дня (Batch cooking)",
};

export const PDF_FORMAT_LABELS: Record<PdfDisplayFormat, string> = {
  grams: "Только точные граммы",
  both: "Граммы + бытовые меры (ложки, шт., порции)",
  household: "Только бытовые меры (приблизительно)",
};

export const COMMON_ALLERGENS = [
  "Молоко и лактоза",
  "Яйца",
  "Глютен",
  "Рыба",
  "Морепродукты",
  "Орехи и арахис",
  "Соя",
];

export const COMMON_RESTRICTIONS = [
  "Без свинины",
  "Без говядины",
  "Вегетарианство",
  "Пескетарианство",
  "Без лактозы",
  "Без глютена",
  "Без добавленного сахара",
];
