import * as XLSX from "xlsx";
import type { FoodCategory, FoodItem, PreparationState } from "../types/nutrition";
import { FOOD_CATEGORY_LABELS, PREPARATION_STATE_LABELS } from "../data/labels";

export interface ImportedFoodPreviewRow {
  rowIndex: number;
  item: FoodItem;
  isDuplicate: boolean;
  validationErrors: string[];
  selected: boolean;
}

const CATEGORY_BY_LABEL = new Map<string, FoodCategory>(
  Object.entries(FOOD_CATEGORY_LABELS).map(([k, v]) => [v.toLowerCase(), k as FoodCategory])
);

const STATE_BY_LABEL = new Map<string, PreparationState>(
  Object.entries(PREPARATION_STATE_LABELS).map(([k, v]) => [v.toLowerCase(), k as PreparationState])
);

function parseNumber(val: unknown): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : NaN;
  if (typeof val === "string") {
    const cleaned = val.trim().replace(",", ".").replace(/\s+/g, "");
    if (!cleaned) return NaN;
    return Number(cleaned);
  }
  return NaN;
}

function normalizeName(name: string, state: PreparationState): string {
  return `${name.trim().toLowerCase().replace(/\s+/g, " ")}__${state}`;
}

function mapCategory(raw: unknown): FoodCategory {
  if (typeof raw !== "string") return "ready_meals";
  const lower = raw.trim().toLowerCase();
  if (lower in FOOD_CATEGORY_LABELS) return lower as FoodCategory;
  const matched = CATEGORY_BY_LABEL.get(lower);
  if (matched) return matched;
  for (const [label, key] of CATEGORY_BY_LABEL.entries()) {
    if (lower.includes(label) || label.includes(lower)) return key;
  }
  return "ready_meals";
}

function mapPreparationState(raw: unknown): PreparationState {
  if (typeof raw !== "string") return "ready";
  const lower = raw.trim().toLowerCase();
  if (lower in PREPARATION_STATE_LABELS) return lower as PreparationState;
  const matched = STATE_BY_LABEL.get(lower);
  if (matched) return matched;
  if (lower.includes("сыр")) return "raw";
  if (lower.includes("сух")) return "dry";
  if (lower.includes("вар")) return "boiled";
  if (lower.includes("жар")) return "fried";
  if (lower.includes("запеч")) return "baked";
  if (lower.includes("пар")) return "steamed";
  if (lower.includes("туш")) return "stewed";
  return "ready";
}

function pickColumn(row: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase().includes(cand.toLowerCase()));
    if (found !== undefined) return row[found];
  }
  return undefined;
}

export async function parseFoodSpreadsheetFile(
  file: File,
  existingFoods: FoodItem[]
): Promise<ImportedFoodPreviewRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", codepage: 65001 });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    throw new Error("Файл не содержит листов с данными.");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  if (rows.length === 0) {
    throw new Error("Таблица пуста. Добавьте хотя бы одну строку с продуктом.");
  }

  const existingKeys = new Set(
    existingFoods.map((f) => normalizeName(f.name, f.preparationState))
  );

  return rows.map((row, idx) => {
    const nameRaw = pickColumn(row, ["название", "продукт", "наименование", "name", "food"]);
    const brandRaw = pickColumn(row, ["бренд", "марка", "brand"]);
    const categoryRaw = pickColumn(row, ["категория", "раздел", "category"]);
    const stateRaw = pickColumn(row, ["состояние", "приготовление", "state", "prep"]);
    const kcalRaw = pickColumn(row, ["калор", "ккал", "kcal", "calories"]);
    const proteinRaw = pickColumn(row, ["бел", "protein"]);
    const fatRaw = pickColumn(row, ["жир", "fat"]);
    const carbsRaw = pickColumn(row, ["углев", "carb"]);
    const sourceRaw = pickColumn(row, ["источник", "source"]);

    const name = String(nameRaw ?? "").trim();
    const brand = String(brandRaw ?? "").trim() || undefined;
    const category = mapCategory(categoryRaw);
    const preparationState = mapPreparationState(stateRaw);

    const caloriesPer100g = parseNumber(kcalRaw);
    const proteinPer100g = parseNumber(proteinRaw);
    const fatPer100g = parseNumber(fatRaw);
    const carbsPer100g = parseNumber(carbsRaw);

    const validationErrors: string[] = [];
    if (!name) validationErrors.push("Не указано название");
    if (Number.isNaN(caloriesPer100g) || caloriesPer100g < 0 || caloriesPer100g > 950) {
      validationErrors.push("Некорректные ккал (0–950)");
    }
    if (Number.isNaN(proteinPer100g) || proteinPer100g < 0 || proteinPer100g > 100) {
      validationErrors.push("Некорректные белки (0–100)");
    }
    if (Number.isNaN(fatPer100g) || fatPer100g < 0 || fatPer100g > 100) {
      validationErrors.push("Некорректные жиры (0–100)");
    }
    if (Number.isNaN(carbsPer100g) || carbsPer100g < 0 || carbsPer100g > 100) {
      validationErrors.push("Некорректные углеводы (0–100)");
    }

    if (validationErrors.length === 0) {
      const macroKcal = proteinPer100g * 4 + fatPer100g * 9 + carbsPer100g * 4;
      if (Math.abs(macroKcal - caloriesPer100g) > Math.max(45, caloriesPer100g * 0.25)) {
        validationErrors.push(
          `Расхождение КБЖУ: по макронутриентам ${Math.round(macroKcal)} ккал, указано ${caloriesPer100g} ккал`
        );
      }
    }

    const key = normalizeName(name, preparationState);
    const isDuplicate = Boolean(name) && existingKeys.has(key);

    const item: FoodItem = {
      id: `imp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      name: name || `Строка ${idx + 2}`,
      brand,
      category,
      caloriesPer100g: Number.isNaN(caloriesPer100g) ? 0 : Number(caloriesPer100g.toFixed(1)),
      proteinPer100g: Number.isNaN(proteinPer100g) ? 0 : Number(proteinPer100g.toFixed(1)),
      fatPer100g: Number.isNaN(fatPer100g) ? 0 : Number(fatPer100g.toFixed(1)),
      carbsPer100g: Number.isNaN(carbsPer100g) ? 0 : Number(carbsPer100g.toFixed(1)),
      preparationState,
      verificationStatus: "custom",
      source: String(sourceRaw ?? "").trim() || `Импорт (${file.name})`,
      householdUnits: [],
    };

    return {
      rowIndex: idx + 2,
      item,
      isDuplicate,
      validationErrors,
      selected: validationErrors.length === 0 && !isDuplicate,
    };
  });
}

export function downloadSampleFoodCsv(): void {
  const header = "Название;Бренд;Категория;Состояние;Калории;Белки;Жиры;Углеводы;Источник\n";
  const sample =
    "Индейка голень без кожи (сырая);;Птица;Сырой;118;20.1;3.8;0;ФИЦ питания\n" +
    "Творог зернёный 5%;Простоквашино;Молочные продукты;Готовый к употреблению;105;12.0;5.0;3.0;Этикетка\n";
  const blob = new Blob(["\uFEFF" + header + sample], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shablon_produktov.csv";
  a.click();
  URL.revokeObjectURL(url);
}
