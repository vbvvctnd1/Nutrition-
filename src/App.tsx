import { useState } from "react";
import type {
  AppBackupPayload,
  AppRoute,
  ClientProfile,
  FoodItem,
  NutritionPlan,
  TrainerSettings,
} from "./types/nutrition";
import { storageRepo } from "./utils/storage";
import { Layout } from "./components/Layout";
import { DashboardView } from "./components/DashboardView";
import { ClientsView } from "./components/ClientsView";
import { MealPlannerView } from "./components/MealPlannerView";
import { FoodDatabaseView } from "./components/FoodDatabaseView";
import { SettingsView } from "./components/SettingsView";
import { ClientModal } from "./components/ClientModal";

export default function App() {
  const [route, setRoute] = useState<AppRoute>("dashboard");

  const [clients, setClients] = useState<ClientProfile[]>(() => storageRepo.loadClients());
  const [foods, setFoods] = useState<FoodItem[]>(() => storageRepo.loadFoods());
  const [plans, setPlans] = useState<NutritionPlan[]>(() => storageRepo.loadPlans());
  const [settings, setSettings] = useState<TrainerSettings>(() => storageRepo.loadSettings());

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [plannerClientId, setPlannerClientId] = useState<string | null>(null);
  const [plannerPlanId, setPlannerPlanId] = useState<string | null>(null);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientProfile | undefined>(undefined);

  const handleSaveClient = (saved: ClientProfile) => {
    setClients((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      const next = exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev];
      storageRepo.saveClients(next);
      return next;
    });
    setIsClientModalOpen(false);
    setEditingClient(undefined);
    setSelectedClientId(saved.id);
    setRoute("clients");
  };

  const handleUpdateClient = (updated: ClientProfile) => {
    setClients((prev) => {
      const next = prev.map((c) => (c.id === updated.id ? updated : c));
      storageRepo.saveClients(next);
      return next;
    });
  };

  const handleDeleteClient = (clientId: string) => {
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== clientId);
      storageRepo.saveClients(next);
      return next;
    });
    setPlans((prev) => {
      const next = prev.filter((p) => p.clientId !== clientId);
      storageRepo.savePlans(next);
      return next;
    });
    if (selectedClientId === clientId) setSelectedClientId(null);
  };

  const handleOpenClient = (clientId: string | null) => {
    if (clientId) {
      const now = new Date().toISOString();
      setClients((prev) => {
        const next = prev.map((c) => (c.id === clientId ? { ...c, lastOpenedAt: now } : c));
        storageRepo.saveClients(next);
        return next;
      });
    }
    setSelectedClientId(clientId);
    setRoute("clients");
  };

  const handleOpenPlanner = (clientId?: string, planId?: string) => {
    setPlannerClientId(clientId || selectedClientId || clients[0]?.id || null);
    setPlannerPlanId(planId || null);
    setRoute("planner");
  };

  // Food DB handlers
  const handleAddFood = (food: FoodItem) => {
    setFoods((prev) => {
      const next = [food, ...prev];
      storageRepo.saveFoods(next);
      return next;
    });
  };

  const handleUpdateFood = (food: FoodItem) => {
    setFoods((prev) => {
      const next = prev.map((f) => (f.id === food.id ? food : f));
      storageRepo.saveFoods(next);
      return next;
    });
  };

  const handleDeleteFood = (foodId: string) => {
    setFoods((prev) => {
      const next = prev.filter((f) => f.id !== foodId);
      storageRepo.saveFoods(next);
      return next;
    });
  };

  const handleBulkAddFoods = (items: FoodItem[]) => {
    setFoods((prev) => {
      const next = [...items, ...prev];
      storageRepo.saveFoods(next);
      return next;
    });
  };

  // Plan handlers
  const handleSavePlan = (plan: NutritionPlan) => {
    setPlans((prev) => {
      const exists = prev.some((p) => p.id === plan.id);
      const next = exists ? prev.map((p) => (p.id === plan.id ? plan : p)) : [plan, ...prev];
      storageRepo.savePlans(next);
      return next;
    });
  };

  const handleDeletePlan = (planId: string) => {
    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== planId);
      storageRepo.savePlans(next);
      return next;
    });
  };

  // Settings & Backup handlers
  const handleSaveSettings = (next: TrainerSettings) => {
    setSettings(next);
    storageRepo.saveSettings(next);
  };

  const handleRestoreBackup = (payload: AppBackupPayload) => {
    storageRepo.restoreBackup(payload);
    setClients(payload.clients);
    setFoods(payload.foods);
    setPlans(payload.plans);
    setSettings(payload.settings);
    setSelectedClientId(null);
  };

  return (
    <Layout
      activeRoute={route}
      onNavigate={(r) => {
        if (r === "planner" && !plannerClientId && clients.length > 0) {
          setPlannerClientId(selectedClientId || clients[0].id);
          setPlannerPlanId(null);
        }
        setRoute(r);
      }}
      onQuickCreatePlan={() => handleOpenPlanner()}
      settings={settings}
    >
      {route === "dashboard" ? (
        <DashboardView
          clients={clients}
          plans={plans}
          onAddClient={() => {
            setEditingClient(undefined);
            setIsClientModalOpen(true);
          }}
          onCreatePlan={(clientId) => handleOpenPlanner(clientId)}
          onOpenClient={(clientId) => handleOpenClient(clientId)}
          onGoToClients={() => {
            setSelectedClientId(null);
            setRoute("clients");
          }}
        />
      ) : null}

      {route === "clients" ? (
        <ClientsView
          clients={clients}
          foods={foods}
          plans={plans}
          selectedClientId={selectedClientId}
          onSelectClient={handleOpenClient}
          onCreateClientClick={() => {
            setEditingClient(undefined);
            setIsClientModalOpen(true);
          }}
          onEditClientClick={(client) => {
            setEditingClient(client);
            setIsClientModalOpen(true);
          }}
          onUpdateClient={handleUpdateClient}
          onDeleteClient={handleDeleteClient}
          onQueueNewFood={(name) => {
            const exists = foods.some(
              (f) => f.name.trim().toLowerCase() === name.trim().toLowerCase()
            );
            if (!exists) {
              handleAddFood({
                id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                name: name.trim(),
                category: "ready_meals",
                caloriesPer100g: 0,
                proteinPer100g: 0,
                fatPer100g: 0,
                carbsPer100g: 0,
                preparationState: "ready",
                verificationStatus: "ai_pending",
                source: "Предложено из разбора привычек (требует заполнения КБЖУ)",
                householdUnits: [],
              });
            }
          }}
          onOpenPlannerForClient={(clientId) => handleOpenPlanner(clientId)}
          onOpenSavedPlan={(planId) => {
            const p = plans.find((x) => x.id === planId);
            handleOpenPlanner(p?.clientId, planId);
          }}
          onDeletePlan={handleDeletePlan}
        />
      ) : null}

      {route === "planner" ? (
        <MealPlannerView
          key={`${plannerClientId || "none"}_${plannerPlanId || "new"}`}
          clients={clients}
          foods={foods}
          plans={plans}
          settings={settings}
          initialClientId={plannerClientId}
          initialPlanId={plannerPlanId}
          onSavePlan={handleSavePlan}
          onCreateClientClick={() => {
            setEditingClient(undefined);
            setIsClientModalOpen(true);
          }}
        />
      ) : null}

      {route === "foods" ? (
        <FoodDatabaseView
          foods={foods}
          onAddFood={handleAddFood}
          onUpdateFood={handleUpdateFood}
          onDeleteFood={handleDeleteFood}
          onBulkAddFoods={handleBulkAddFoods}
        />
      ) : null}

      {route === "settings" ? (
        <SettingsView
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onRestoreBackup={handleRestoreBackup}
        />
      ) : null}

      {isClientModalOpen ? (
        <ClientModal
          initialClient={editingClient}
          onClose={() => {
            setIsClientModalOpen(false);
            setEditingClient(undefined);
          }}
          onSave={handleSaveClient}
        />
      ) : null}
    </Layout>
  );
}
