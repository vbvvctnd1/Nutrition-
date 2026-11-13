import type {
  AppBackupPayload,
  ClientProfile,
  FoodItem,
  NutritionPlan,
  TrainerSettings,
} from "../types/nutrition";
import { DEFAULT_FOODS } from "../data/defaultFoods";

const KEYS = {
  CLIENTS: "nutriplan_clients_v1",
  FOODS: "nutriplan_foods_v1",
  PLANS: "nutriplan_plans_v1",
  SETTINGS: "nutriplan_settings_v1",
} as const;

export const DEFAULT_SETTINGS: TrainerSettings = {
  trainerName: "Алексей Соколов",
  brandTitle: "Персональное сопровождение по питанию",
  contactInfo: "Telegram: @trainer_nutrition · +7 (999) 000-00-00",
  defaultPdfFormat: "both",
  defaultRecommendations:
    "1. Пейте достаточное количество чистой воды (ориентир 30–35 мл на 1 кг массы тела).\n" +
    "2. Взвешивайте крупы и мясо в том состоянии, которое указано в плане (сухой/сырой или варёный/готовый).\n" +
    "3. Старайтесь не пропускать приёмы пищи и добавляйте свежие овощи или зелень к основным приёмам.\n" +
    "4. При желании заменить продукт используйте эквивалентные замены из вашего списка.",
};

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storageRepo = {
  loadClients(): ClientProfile[] {
    return safeReadJson<ClientProfile[]>(KEYS.CLIENTS, []);
  },
  saveClients(clients: ClientProfile[]): void {
    safeWriteJson(KEYS.CLIENTS, clients);
  },

  loadFoods(): FoodItem[] {
    const stored = safeReadJson<FoodItem[] | null>(KEYS.FOODS, null);
    if (!stored || stored.length === 0) {
      safeWriteJson(KEYS.FOODS, DEFAULT_FOODS);
      return DEFAULT_FOODS;
    }
    return stored;
  },
  saveFoods(foods: FoodItem[]): void {
    safeWriteJson(KEYS.FOODS, foods);
  },

  loadPlans(): NutritionPlan[] {
    return safeReadJson<NutritionPlan[]>(KEYS.PLANS, []);
  },
  savePlans(plans: NutritionPlan[]): void {
    safeWriteJson(KEYS.PLANS, plans);
  },

  loadSettings(): TrainerSettings {
    const stored = safeReadJson<Partial<TrainerSettings> | null>(KEYS.SETTINGS, null);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...stored };
  },
  saveSettings(settings: TrainerSettings): void {
    safeWriteJson(KEYS.SETTINGS, settings);
  },

  exportBackup(): AppBackupPayload {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      clients: this.loadClients(),
      foods: this.loadFoods(),
      plans: this.loadPlans(),
      settings: this.loadSettings(),
    };
  },

  validateBackup(raw: unknown): { valid: true; data: AppBackupPayload } | { valid: false; error: string } {
    if (!raw || typeof raw !== "object") {
      return { valid: false, error: "Файл резервной копии повреждён или имеет неверный формат JSON." };
    }
    const obj = raw as Record<string, unknown>;
    if (obj.version !== 1) {
      return { valid: false, error: "Неподдерживаемая версия резервной копии." };
    }
    if (!Array.isArray(obj.clients) || !Array.isArray(obj.foods) || !Array.isArray(obj.plans)) {
      return { valid: false, error: "В файле отсутствуют обязательные разделы (clients, foods, plans)." };
    }
    if (!obj.settings || typeof obj.settings !== "object") {
      return { valid: false, error: "В файле отсутствуют настройки тренера." };
    }

    for (const c of obj.clients) {
      const client = c as Partial<ClientProfile>;
      if (!client.id || !client.fullName || typeof client.weightKg !== "number") {
        return { valid: false, error: "Обнаружена некорректная запись клиента в резервной копии." };
      }
    }

    for (const f of obj.foods) {
      const food = f as Partial<FoodItem>;
      if (!food.id || !food.name || typeof food.caloriesPer100g !== "number") {
        return { valid: false, error: "Обнаружен некорректный продукт в резервной копии." };
      }
    }

    return { valid: true, data: obj as unknown as AppBackupPayload };
  },

  restoreBackup(payload: AppBackupPayload): void {
    this.saveClients(payload.clients);
    this.saveFoods(payload.foods);
    this.savePlans(payload.plans);
    this.saveSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
  },
};
