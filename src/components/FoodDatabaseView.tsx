import React, { useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Upload,
  Edit3,
  Trash2,
  X,
  Check,
  Download,
  AlertTriangle,
} from "lucide-react";
import type {
  FoodCategory,
  FoodItem,
  HouseholdUnit,
  PreparationState,
} from "../types/nutrition";
import {
  COMMON_ALLERGENS,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  PREPARATION_STATE_LABELS,
  VERIFICATION_STATUS_LABELS,
} from "../data/labels";
import {
  downloadSampleFoodCsv,
  parseFoodSpreadsheetFile,
  type ImportedFoodPreviewRow,
} from "../utils/importExportFoods";

interface FoodDatabaseViewProps {
  foods: FoodItem[];
  onAddFood: (food: FoodItem) => void;
  onUpdateFood: (food: FoodItem) => void;
  onDeleteFood: (foodId: string) => void;
  onBulkAddFoods: (items: FoodItem[]) => void;
}

export const FoodDatabaseView: React.FC<FoodDatabaseViewProps> = ({
  foods,
  onAddFood,
  onUpdateFood,
  onDeleteFood,
  onBulkAddFoods,
}) => {
  const [viewMode, setViewMode] = useState<"main" | "review">("main");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FoodCategory | "all">("all");
  const [stateFilter, setStateFilter] = useState<PreparationState | "all">("all");

  // Add/Edit modal
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Import modal
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importRows, setImportRows] = useState<ImportedFoodPreviewRow[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const pendingReviewCount = useMemo(
    () => foods.filter((f) => f.verificationStatus === "ai_pending").length,
    [foods]
  );

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return foods.filter((f) => {
      if (viewMode === "review") {
        if (f.verificationStatus !== "ai_pending") return false;
      } else {
        if (f.verificationStatus === "ai_pending") return false;
      }
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (stateFilter !== "all" && f.preparationState !== stateFilter) return false;
      if (q) {
        const hay = `${f.name} ${f.brand || ""} ${f.source || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [foods, viewMode, search, categoryFilter, stateFilter]);

  const handleOpenAdd = () => {
    setEditingFood(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (food: FoodItem) => {
    setEditingFood(food);
    setIsModalOpen(true);
  };

  const handleApproveAiFood = (food: FoodItem) => {
    onUpdateFood({
      ...food,
      verificationStatus: "verified",
      source: food.source || "Подтверждено тренером",
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);

    try {
      const preview = await parseFoodSpreadsheetFile(file, foods);
      setImportRows(preview);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Не удалось прочитать файл CSV или Excel."
      );
    }
  };

  const handleConfirmImport = () => {
    if (!importRows) return;
    const toImport = importRows
      .filter((r) => r.selected && r.validationErrors.length === 0)
      .map((r) => r.item);
    if (toImport.length > 0) {
      onBulkAddFoods(toImport);
    }
    setImportRows(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            База продуктов
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Проверенные продукты с точным разделением сырых, сухих и приготовленных позиций.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-700 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>Импорт CSV / Excel</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить продукт</span>
          </button>
        </div>
      </div>

      {importError ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3">
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="text-xs font-medium underline"
          >
            Скрыть
          </button>
        </div>
      ) : null}

      {/* Tabs: Main DB vs AI Review Queue */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <div className="inline-flex p-1 bg-neutral-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setViewMode("main")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === "main"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Основная база ({foods.length - pendingReviewCount})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("review")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === "review"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            На проверке (предложения ИИ: {pendingReviewCount})
          </button>
        </div>

        <button
          type="button"
          onClick={downloadSampleFoodCsv}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Скачать шаблон CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по названию или бренду..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as FoodCategory | "all")}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        >
          <option value="all">Все категории (19)</option>
          {FOOD_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {FOOD_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as PreparationState | "all")}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        >
          <option value="all">Любое состояние приготовления</option>
          {(Object.keys(PREPARATION_STATE_LABELS) as PreparationState[]).map((st) => (
            <option key={st} value={st}>
              {PREPARATION_STATE_LABELS[st]}
            </option>
          ))}
        </select>
      </div>

      {/* Foods Table / Mobile Cards */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {filteredFoods.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">
            {viewMode === "review"
              ? "Нет продуктов, ожидающих проверки тренера."
              : "По заданным фильтрам продукты не найдены."}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-500">
                    <th className="py-2.5 px-4">Продукт</th>
                    <th className="py-2.5 px-3">Категория / Состояние</th>
                    <th className="py-2.5 px-3 text-right">Ккал</th>
                    <th className="py-2.5 px-3 text-right">Б</th>
                    <th className="py-2.5 px-3 text-right">Ж</th>
                    <th className="py-2.5 px-3 text-right">У</th>
                    <th className="py-2.5 px-3">Статус</th>
                    <th className="py-2.5 px-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-sm">
                  {filteredFoods.map((food) => (
                    <tr key={food.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-neutral-900">{food.name}</div>
                        {food.brand || food.householdUnits.length > 0 ? (
                          <div className="text-xs text-neutral-500">
                            {food.brand ? `${food.brand} · ` : ""}
                            {food.householdUnits.length > 0
                              ? `Меры: ${food.householdUnits.map((u) => `${u.unitName} (${u.gramsPerUnit} г)`).join(", ")}`
                              : ""}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-neutral-600">
                        <div>{FOOD_CATEGORY_LABELS[food.category]}</div>
                        <div className="text-neutral-400">
                          {PREPARATION_STATE_LABELS[food.preparationState]}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-neutral-900">
                        {food.caloriesPer100g}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-700">
                        {food.proteinPer100g}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-700">
                        {food.fatPer100g}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-700">
                        {food.carbsPer100g}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-neutral-500">
                        {VERIFICATION_STATUS_LABELS[food.verificationStatus]}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {food.verificationStatus === "ai_pending" ? (
                            <button
                              type="button"
                              onClick={() => handleApproveAiFood(food)}
                              title="Утвердить в основную базу"
                              className="p-1.5 rounded text-emerald-700 hover:bg-emerald-50"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(food)}
                            aria-label="Редактировать"
                            className="p-1.5 rounded text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteFood(food.id)}
                            aria-label="Удалить"
                            className="p-1.5 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile List */}
            <div className="md:hidden divide-y divide-neutral-200">
              {filteredFoods.map((food) => (
                <div key={food.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">{food.name}</div>
                      <div className="text-xs text-neutral-500">
                        {FOOD_CATEGORY_LABELS[food.category]} · {PREPARATION_STATE_LABELS[food.preparationState]}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(food)}
                        className="p-1.5 text-neutral-500"
                        aria-label="Редактировать"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteFood(food.id)}
                        className="p-1.5 text-neutral-500"
                        aria-label="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-neutral-700">
                    На 100 г: {food.caloriesPer100g} ккал · Б {food.proteinPer100g} г · Ж {food.fatPer100g} г · У {food.carbsPer100g} г
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Food Modal */}
      {isModalOpen ? (
        <FoodFormModal
          initialFood={editingFood}
          onClose={() => setIsModalOpen(false)}
          onSave={(saved) => {
            if (editingFood) onUpdateFood(saved);
            else onAddFood(saved);
            setIsModalOpen(false);
          }}
        />
      ) : null}

      {/* CSV / Excel Import Preview Modal */}
      {importRows ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">
                  Предпросмотр импорта продуктов
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Проверьте корректность КБЖУ и дубликаты перед добавлением в базу.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportRows(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="py-2 pr-3">Импорт</th>
                    <th className="py-2 px-2">Название</th>
                    <th className="py-2 px-2">Категория / Состояние</th>
                    <th className="py-2 px-2 text-right">Ккал</th>
                    <th className="py-2 px-2 text-right">Б/Ж/У</th>
                    <th className="py-2 pl-2">Статус проверки</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {importRows.map((row, idx) => (
                    <tr key={idx} className={row.validationErrors.length > 0 ? "bg-red-50/50" : ""}>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          disabled={row.validationErrors.length > 0}
                          checked={row.selected}
                          onChange={(e) =>
                            setImportRows((prev) =>
                              prev
                                ? prev.map((r, i) =>
                                    i === idx ? { ...r, selected: e.target.checked } : r
                                  )
                                : null
                            )
                          }
                        />
                      </td>
                      <td className="py-2 px-2 font-medium text-neutral-900">
                        {row.item.name}
                      </td>
                      <td className="py-2 px-2 text-neutral-600">
                        {FOOD_CATEGORY_LABELS[row.item.category]} · {PREPARATION_STATE_LABELS[row.item.preparationState]}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">
                        {row.item.caloriesPer100g}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">
                        {row.item.proteinPer100g}/{row.item.fatPer100g}/{row.item.carbsPer100g}
                      </td>
                      <td className="py-2 pl-2">
                        {row.validationErrors.length > 0 ? (
                          <span className="text-red-700 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{row.validationErrors.join("; ")}</span>
                          </span>
                        ) : row.isDuplicate ? (
                          <span className="text-amber-700">Дубликат (пропущен по умолчанию)</span>
                        ) : (
                          <span className="text-emerald-700">Готов к импорту</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between gap-4">
              <span className="text-xs text-neutral-600 tabular-nums">
                Выбрано для импорта: {importRows.filter((r) => r.selected).length} из {importRows.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportRows(null)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
                >
                  Импортировать выбранные
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface FoodFormModalProps {
  initialFood: FoodItem | null;
  onClose: () => void;
  onSave: (food: FoodItem) => void;
}

const FoodFormModal: React.FC<FoodFormModalProps> = ({
  initialFood,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initialFood?.name || "");
  const [brand, setBrand] = useState(initialFood?.brand || "");
  const [category, setCategory] = useState<FoodCategory>(initialFood?.category || "poultry");
  const [preparationState, setPreparationState] = useState<PreparationState>(
    initialFood?.preparationState || "raw"
  );
  const [calories, setCalories] = useState(String(initialFood?.caloriesPer100g ?? ""));
  const [protein, setProtein] = useState(String(initialFood?.proteinPer100g ?? ""));
  const [fat, setFat] = useState(String(initialFood?.fatPer100g ?? ""));
  const [carbs, setCarbs] = useState(String(initialFood?.carbsPer100g ?? ""));
  const [source, setSource] = useState(initialFood?.source || "Добавлено вручную");
  const [allergenTags, setAllergenTags] = useState<string[]>(initialFood?.allergenTags || []);
  const [householdUnits, setHouseholdUnits] = useState<HouseholdUnit[]>(
    initialFood?.householdUnits || []
  );
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitGrams, setNewUnitGrams] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleAllergen = (tag: string) => {
    setAllergenTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  };

  const handleAddUnit = () => {
    const g = Number(newUnitGrams);
    if (!newUnitName.trim() || !Number.isFinite(g) || g <= 0) return;
    setHouseholdUnits((prev) => [
      ...prev,
      { unitName: newUnitName.trim(), gramsPerUnit: Math.round(g) },
    ]);
    setNewUnitName("");
    setNewUnitGrams("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const k = Number(calories);
    const p = Number(protein);
    const f = Number(fat);
    const c = Number(carbs);

    if (!name.trim()) {
      setError("Укажите название продукта.");
      return;
    }
    if ([k, p, f, c].some((v) => Number.isNaN(v) || v < 0)) {
      setError("Калории и БЖУ должны быть неотрицательными числами.");
      return;
    }
    if (k > 950 || p > 100 || f > 100 || c > 100) {
      setError("Проверьте значения на 100 г: ккал ≤ 950, каждый макронутриент ≤ 100 г.");
      return;
    }

    const saved: FoodItem = {
      id: initialFood?.id || `food_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      brand: brand.trim() || undefined,
      category,
      preparationState,
      caloriesPer100g: Number(k.toFixed(1)),
      proteinPer100g: Number(p.toFixed(1)),
      fatPer100g: Number(f.toFixed(1)),
      carbsPer100g: Number(c.toFixed(1)),
      verificationStatus:
        initialFood?.verificationStatus === "verified" ? "verified" : "custom",
      source: source.trim() || "Добавлено вручную",
      householdUnits,
      allergenTags,
    };
    onSave(saved);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-neutral-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">
            {initialFood ? "Редактировать продукт" : "Добавить продукт в базу"}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800">
              {error}
            </div>
          ) : null}

          <label className="block">
            <span className="text-xs font-medium text-neutral-700">Название (с указанием состояния) *</span>
            <input
              type="text"
              required
              placeholder="Например: Гречка (варёная на воде)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-700">Категория</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FoodCategory)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                {FOOD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {FOOD_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-neutral-700">Состояние приготовления *</span>
              <select
                value={preparationState}
                onChange={(e) => setPreparationState(e.target.value as PreparationState)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                {(Object.keys(PREPARATION_STATE_LABELS) as PreparationState[]).map((st) => (
                  <option key={st} value={st}>
                    {PREPARATION_STATE_LABELS[st]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-700">Ккал / 100 г *</span>
              <input
                type="number"
                step="0.1"
                required
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-700">Белки / 100 г *</span>
              <input
                type="number"
                step="0.1"
                required
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-700">Жиры / 100 г *</span>
              <input
                type="number"
                step="0.1"
                required
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-700">Углеводы / 100 г *</span>
              <input
                type="number"
                step="0.1"
                required
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-700">Бренд (если применимо)</span>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-700">Источник данных</span>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {/* Allergen tags */}
          <div>
            <span className="text-xs font-medium text-neutral-700 block mb-1.5">
              Содержит аллергены
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ALLERGENS.map((tag) => {
                const active = allergenTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleAllergen(tag)}
                    className={`px-2.5 py-1 rounded text-xs border ${
                      active
                        ? "bg-red-50 border-red-300 text-red-800"
                        : "bg-white border-neutral-200 text-neutral-600"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Household Units */}
          <div className="space-y-2 pt-2 border-t border-neutral-100">
            <span className="text-xs font-medium text-neutral-700 block">
              Бытовые меры измерения (для этого конкретного продукта)
            </span>
            {householdUnits.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-neutral-50 rounded px-3 py-1.5">
                <span>
                  1 {u.unitName} = <strong className="tabular-nums">{u.gramsPerUnit} г</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setHouseholdUnits((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-neutral-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Мера (напр. ст. ложка)"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              />
              <input
                type="number"
                placeholder="Грамм"
                value={newUnitGrams}
                onChange={(e) => setNewUnitGrams(e.target.value)}
                className="w-24 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs tabular-nums"
              />
              <button
                type="button"
                onClick={handleAddUnit}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-700"
              >
                Добавить
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
            >
              Сохранить продукт
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
