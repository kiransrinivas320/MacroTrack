import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Flame,
  Heart,
  Home,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Trash2,
  TrendingUp,
  Trophy,
  Wallet,
  X,
  Utensils,
  Target,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

type FoodEntry = {
  id: string;
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  cost: number;
  createdAt: string;
};

type DayData = {
  date: string;
  foods: FoodEntry[];
  completed: boolean;
};

type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  budget: number;
};

const DEFAULT_GOALS: Goals = {
  calories: 2400,
  protein: 150,
  carbs: 280,
  fat: 75,
  fiber: 30,
  budget: 300,
};

const STORAGE_KEY = "macrotrack_days_v1";
const GOALS_KEY = "macrotrack_goals_v1";

const emptyFood = {
  name: "",
  quantity: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  cost: "",
};

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )}`;
}

function getDateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(key: string) {
  return getDateFromKey(key).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getMonthName(date: Date) {
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function createEmptyDay(date: string): DayData {
  return {
    date,
    foods: [],
    completed: false,
  };
}

function App() {
  const todayKey = getDateKey(new Date());

  const [days, setDays] =
    useState<Record<string, DayData>>({});

  const [goals, setGoals] =
    useState<Goals>(DEFAULT_GOALS);

  const [user, setUser] =
    useState<any>(null);

  const [profile, setProfile] =
    useState<any>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [authMode, setAuthMode] =
    useState<"login" | "signup">("login");

  const [authEmail, setAuthEmail] =
    useState("");

  const [authPassword, setAuthPassword] =
    useState("");

  const [authUsername, setAuthUsername] =
    useState("");

  const [authError, setAuthError] =
    useState("");

  const [authMessage, setAuthMessage] =
    useState("");

  const [authBusy, setAuthBusy] =
    useState(false);

  const [selectedDate, setSelectedDate] =
    useState(todayKey);

  const [showFoodModal, setShowFoodModal] =
    useState(false);

  const [showSettingsModal, setShowSettingsModal] =
    useState(false);

  const [editingFood, setEditingFood] =
    useState<FoodEntry | null>(null);

  const [foodForm, setFoodForm] =
    useState(emptyFood);

  const [settingsForm, setSettingsForm] =
    useState<Goals>(goals);

  const [currentMonth, setCurrentMonth] =
    useState(
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
    );

  const [activeTab, setActiveTab] =
    useState("home");

  const [ownerUsers, setOwnerUsers] =
    useState<any[]>([]);

  const [ownerLoading, setOwnerLoading] =
    useState(false);

  const [ownerError, setOwnerError] =
    useState("");

  const [selectedOwnerId, setSelectedOwnerId] =
    useState<string | null>(null);

  const [ownerSearch, setOwnerSearch] =
    useState("");

  const currentDay =
    days[selectedDate] ||
    createEmptyDay(selectedDate);

  async function loadCloudData(userId: string) {
    setAuthLoading(true);

    try {
      const [
        profileResult,
        logsResult,
        foodsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single(),

        supabase
          .from("daily_logs")
          .select("*")
          .eq("user_id", userId)
          .order("log_date", { ascending: true }),

        supabase
          .from("food_entries")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (logsResult.error) {
        throw logsResult.error;
      }

      if (foodsResult.error) {
        throw foodsResult.error;
      }

      const profileRow = profileResult.data;
      setProfile(profileRow);

      const cloudLogs = logsResult.data || [];
      const cloudFoods = foodsResult.data || [];

      /*
        If this account has no cloud data yet, migrate the
        user's old localStorage data once so nothing already
        entered in MacroTrack is lost.
      */
      let localDays: Record<string, DayData> = {};

      try {
        const savedDays = localStorage.getItem(STORAGE_KEY);
        if (savedDays) {
          localDays = JSON.parse(savedDays);
        }
      } catch {
        localDays = {};
      }

      const localGoals: Goals = (() => {
        try {
          const savedGoals = localStorage.getItem(GOALS_KEY);
          return savedGoals
            ? {
                ...DEFAULT_GOALS,
                ...JSON.parse(savedGoals),
              }
            : DEFAULT_GOALS;
        } catch {
          return DEFAULT_GOALS;
        }
      })();

      if (
        cloudLogs.length === 0 &&
        cloudFoods.length === 0 &&
        Object.keys(localDays).length > 0
      ) {
        const dates = Object.values(localDays);

        if (dates.length > 0) {
          const logRows = dates.map((day) => ({
            user_id: userId,
            log_date: day.date,
            completed: !!day.completed,
          }));

          const { error: logInsertError } =
            await supabase
              .from("daily_logs")
              .upsert(logRows, {
                onConflict: "user_id,log_date",
              });

          if (logInsertError) {
            throw logInsertError;
          }

          const { data: insertedLogs, error: insertedLogsError } =
            await supabase
              .from("daily_logs")
              .select("id, log_date")
              .eq("user_id", userId);

          if (insertedLogsError) {
            throw insertedLogsError;
          }

          const logIdByDate: Record<string, string> = {};

          (insertedLogs || []).forEach((log) => {
            logIdByDate[log.log_date] = log.id;
          });

          const foodRows = dates.flatMap((day) =>
            day.foods.map((food) => ({
              user_id: userId,
              daily_log_id: logIdByDate[day.date],
              food_name: food.name,
              quantity:
                parseFloat(food.quantity) || 0,
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fiber: food.fiber,
              fat: food.fat,
              cost: food.cost,
              created_at:
                food.createdAt ||
                new Date().toISOString(),
            }))
          ).filter((row) => row.daily_log_id);

          if (foodRows.length > 0) {
            const { error: foodInsertError } =
              await supabase
                .from("food_entries")
                .insert(foodRows);

            if (foodInsertError) {
              throw foodInsertError;
            }
          }

          await supabase
            .from("profiles")
            .update({
              calorie_goal: localGoals.calories,
              protein_goal: localGoals.protein,
              carbs_goal: localGoals.carbs,
              fat_goal: localGoals.fat,
              fiber_goal: localGoals.fiber,
              budget_goal: localGoals.budget,
            })
            .eq("id", userId);

          return loadCloudData(userId);
        }
      }

      const nextGoals: Goals = {
        calories:
          Number(profileRow.calorie_goal) ||
          DEFAULT_GOALS.calories,
        protein:
          Number(profileRow.protein_goal) ||
          DEFAULT_GOALS.protein,
        carbs:
          Number(profileRow.carbs_goal) ||
          DEFAULT_GOALS.carbs,
        fat:
          Number(profileRow.fat_goal) ||
          DEFAULT_GOALS.fat,
        fiber:
          Number(profileRow.fiber_goal) ||
          DEFAULT_GOALS.fiber,
        budget:
          Number(profileRow.budget_goal) ||
          DEFAULT_GOALS.budget,
      };

      const nextDays: Record<string, DayData> = {};

      cloudLogs.forEach((log) => {
        nextDays[log.log_date] = {
          date: log.log_date,
          foods: [],
          completed: !!log.completed,
        };
      });

      const logDateById: Record<string, string> = {};

      cloudLogs.forEach((log) => {
        logDateById[log.id] = log.log_date;
      });

      cloudFoods.forEach((food) => {
        const date = logDateById[food.daily_log_id];

        if (!date) return;

        if (!nextDays[date]) {
          nextDays[date] =
            createEmptyDay(date);
        }

        nextDays[date].foods.push({
          id: food.id,
          name: food.food_name,
          quantity:
            food.quantity === null ||
            food.quantity === undefined
              ? ""
              : `${food.quantity} g`,
          calories: Number(food.calories) || 0,
          protein: Number(food.protein) || 0,
          carbs: Number(food.carbs) || 0,
          fat: Number(food.fat) || 0,
          fiber: Number(food.fiber) || 0,
          cost: Number(food.cost) || 0,
          createdAt:
            food.created_at ||
            new Date().toISOString(),
        });
      });

      setGoals(nextGoals);
      setSettingsForm(nextGoals);
      setDays(nextDays);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(nextDays)
      );

      localStorage.setItem(
        GOALS_KEY,
        JSON.stringify(nextGoals)
      );
    } catch (error: any) {
      console.error(error);
      setAuthError(
        error?.message ||
        "Could not load your MacroTrack data."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      const sessionUser =
        data.session?.user || null;

      setUser(sessionUser);

      if (sessionUser) {
        loadCloudData(sessionUser.id);
      } else {
        setAuthLoading(false);
      }
    });

    const {
      data: {
        subscription,
      },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const sessionUser =
          session?.user || null;

        setUser(sessionUser);

        if (sessionUser) {
          setTimeout(() => {
            loadCloudData(sessionUser.id);
          }, 0);
        } else {
          setProfile(null);
          setDays({});
          setGoals(DEFAULT_GOALS);
          setAuthLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(days)
      );
    }
  }, [days, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(
        GOALS_KEY,
        JSON.stringify(goals)
      );
    }
  }, [goals, user]);

  const totals = useMemo(() => {
    return currentDay.foods.reduce(
      (acc, food) => {
        acc.calories += food.calories;
        acc.protein += food.protein;
        acc.carbs += food.carbs;
        acc.fat += food.fat;
        acc.fiber += food.fiber;
        acc.cost += food.cost;

        return acc;
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        cost: 0,
      }
    );
  }, [currentDay.foods]);

  function getPercentage(
    value: number,
    target: number
  ) {
    if (!target) return 0;

    return Math.round(
      (value / target) * 100
    );
  }

  function getProgressWidth(
    value: number,
    target: number
  ) {
    if (!target) return 0;

    return Math.min(
      (value / target) * 100,
      140
    );
  }

  function getDifference(
    value: number,
    target: number
  ) {
    return target - value;
  }

  const calorieDifference =
    getDifference(
      totals.calories,
      goals.calories
    );

  const proteinDifference =
    getDifference(
      totals.protein,
      goals.protein
    );

  const carbsDifference =
    getDifference(
      totals.carbs,
      goals.carbs
    );

  const fatDifference =
    getDifference(
      totals.fat,
      goals.fat
    );

  const fiberDifference =
    getDifference(
      totals.fiber,
      goals.fiber
    );

  const budgetDifference =
    getDifference(
      totals.cost,
      goals.budget
    );

  /*
    Calculate the real tracking streak from completed days.
    The streak starts today and moves backwards until the
    first day that was not completed.
  */
  const trackingStreak = useMemo(() => {
    let streak = 0;
    const cursor = new Date();

    while (true) {
      const key = getDateKey(cursor);
      const day = days[key];

      if (!day?.completed) break;

      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }, [days]);

  const completedDays = useMemo(() => {
    return Object.values(days).filter(
      (day) => day.completed
    ).length;
  }, [days]);

  const totalFoodItems = useMemo(() => {
    return Object.values(days).reduce(
      (sum, day) => sum + day.foods.length,
      0
    );
  }, [days]);

  const totalSpending = useMemo(() => {
    return Object.values(days).reduce(
      (sum, day) =>
        sum +
        day.foods.reduce(
          (foodSum, food) =>
            foodSum + food.cost,
          0
        ),
      0
    );
  }, [days]);

  const weeklyAnalytics = useMemo(() => {
    const result: {
      key: string;
      label: string;
      calories: number;
      protein: number;
      spending: number;
      completed: boolean;
    }[] = [];

    const base = getDateFromKey(selectedDate);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(base);
      date.setDate(base.getDate() - i);

      const key = getDateKey(date);
      const day = days[key];

      const dayTotals = (day?.foods || []).reduce(
        (acc, food) => {
          acc.calories += food.calories;
          acc.protein += food.protein;
          acc.spending += food.cost;
          return acc;
        },
        { calories: 0, protein: 0, spending: 0 }
      );

      result.push({
        key,
        label: date.toLocaleDateString("en-IN", {
          weekday: "short",
        }),
        calories: dayTotals.calories,
        protein: dayTotals.protein,
        spending: dayTotals.spending,
        completed: Boolean(day?.completed),
      });
    }

    return result;
  }, [days, selectedDate]);

  const weeklySummary = useMemo(() => {
    const daysWithFood = weeklyAnalytics.filter(
      (day) => day.calories > 0 || day.protein > 0 || day.spending > 0
    );

    const count = daysWithFood.length || 1;

    return {
      averageCalories: Math.round(
        daysWithFood.reduce((sum, day) => sum + day.calories, 0) / count
      ),
      averageProtein: Math.round(
        daysWithFood.reduce((sum, day) => sum + day.protein, 0) / count
      ),
      averageSpending: Math.round(
        daysWithFood.reduce((sum, day) => sum + day.spending, 0) / count
      ),
      completed: weeklyAnalytics.filter((day) => day.completed).length,
    };
  }, [weeklyAnalytics]);

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay();

  const calendarCells: (number | null)[] = [];

  for (
    let i = 0;
    i < firstDayOfMonth;
    i++
  ) {
    calendarCells.push(null);
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    calendarCells.push(day);
  }

  const weekdayLabels = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ];

  function updateFoodForm(
    field: keyof typeof emptyFood,
    value: string
  ) {
    setFoodForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function openAddFood() {
    setEditingFood(null);
    setFoodForm(emptyFood);
    setShowFoodModal(true);
  }

  function openEditFood(food: FoodEntry) {
    setEditingFood(food);

    setFoodForm({
      name: food.name,
      quantity: food.quantity,
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs),
      fat: String(food.fat),
      fiber: String(food.fiber),
      cost: String(food.cost),
    });

    setShowFoodModal(true);
  }

  async function handleAuth() {
    setAuthError("");
    setAuthMessage("");

    if (!authEmail.trim() || !authPassword) {
      setAuthError("Enter your email and password.");
      return;
    }

    if (
      authMode === "signup" &&
      !authUsername.trim()
    ) {
      setAuthError("Enter a username.");
      return;
    }

    setAuthBusy(true);

    try {
      if (authMode === "signup") {
        const {
          data,
          error,
        } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: {
              username:
                authUsername.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setAuthMessage(
            "Account created. Welcome to MacroTrack."
          );
        } else {
          setAuthMessage(
            "Account created. Check your email to confirm your account, then log in."
          );
        }
      } else {
        const {
          error,
        } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });

        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(
        error?.message ||
        "Authentication failed."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function saveFood() {
    if (!foodForm.name.trim()) {
      alert("Please enter the food name.");
      return;
    }

    if (!foodForm.quantity.trim()) {
      alert("Please enter the quantity.");
      return;
    }

    if (!user) return;

    const createdAt =
      editingFood?.createdAt ||
      new Date().toISOString();

    try {
      const { data: log, error: logError } =
        await supabase
          .from("daily_logs")
          .upsert(
            {
              user_id: user.id,
              log_date: selectedDate,
            },
            {
              onConflict:
                "user_id,log_date",
            }
          )
          .select("id")
          .single();

      if (logError) throw logError;

      if (editingFood) {
        const { error } =
          await supabase
            .from("food_entries")
            .update({
              food_name:
                foodForm.name.trim(),
              quantity:
                parseFloat(foodForm.quantity) || 0,
              calories:
                Number(foodForm.calories) || 0,
              protein:
                Number(foodForm.protein) || 0,
              carbs:
                Number(foodForm.carbs) || 0,
              fat:
                Number(foodForm.fat) || 0,
              fiber:
                Number(foodForm.fiber) || 0,
              cost:
                Number(foodForm.cost) || 0,
            })
            .eq("id", editingFood.id)
            .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { data: insertedFood, error } =
          await supabase
            .from("food_entries")
            .insert({
              user_id: user.id,
              daily_log_id: log.id,
              food_name:
                foodForm.name.trim(),
              quantity:
                parseFloat(foodForm.quantity) || 0,
              calories:
                Number(foodForm.calories) || 0,
              protein:
                Number(foodForm.protein) || 0,
              carbs:
                Number(foodForm.carbs) || 0,
              fat:
                Number(foodForm.fat) || 0,
              fiber:
                Number(foodForm.fiber) || 0,
              cost:
                Number(foodForm.cost) || 0,
              created_at: createdAt,
            })
            .select("*")
            .single();

        if (error) throw error;

        const savedFood: FoodEntry = {
          id:
            insertedFood?.id ||
            crypto.randomUUID(),
          name:
            foodForm.name.trim(),
          quantity:
            `${parseFloat(foodForm.quantity) || 0} g`,
          calories:
            Number(foodForm.calories) || 0,
          protein:
            Number(foodForm.protein) || 0,
          carbs:
            Number(foodForm.carbs) || 0,
          fat:
            Number(foodForm.fat) || 0,
          fiber:
            Number(foodForm.fiber) || 0,
          cost:
            Number(foodForm.cost) || 0,
          createdAt:
            insertedFood?.created_at ||
            createdAt,
        };

        setDays((previous) => {
          const day =
            previous[selectedDate] ||
            createEmptyDay(
              selectedDate
            );

          return {
            ...previous,
            [selectedDate]: {
              ...day,
              foods: [
                ...day.foods,
                savedFood,
              ],
            },
          };
        });
      }

      if (editingFood) {
        const updatedFood: FoodEntry = {
          ...editingFood,
          name:
            foodForm.name.trim(),
          quantity:
            `${parseFloat(foodForm.quantity) || 0} g`,
          calories:
            Number(foodForm.calories) || 0,
          protein:
            Number(foodForm.protein) || 0,
          carbs:
            Number(foodForm.carbs) || 0,
          fat:
            Number(foodForm.fat) || 0,
          fiber:
            Number(foodForm.fiber) || 0,
          cost:
            Number(foodForm.cost) || 0,
        };

        setDays((previous) => {
          const day =
            previous[selectedDate] ||
            createEmptyDay(
              selectedDate
            );

          return {
            ...previous,
            [selectedDate]: {
              ...day,
              foods: day.foods.map(
                (food) =>
                  food.id === editingFood.id
                    ? updatedFood
                    : food
              ),
            },
          };
        });
      }

      setShowFoodModal(false);
      setEditingFood(null);
      setFoodForm(emptyFood);
    } catch (error: any) {
      console.error(error);
      alert(
        error?.message ||
        "Could not save this food entry."
      );
    }
  }

  async function deleteFood(foodId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this food entry?"
    );

    if (!confirmed || !user) return;

    try {
      const { error } =
        await supabase
          .from("food_entries")
          .delete()
          .eq("id", foodId)
          .eq("user_id", user.id);

      if (error) throw error;

      setDays((previous) => {
        const day =
          previous[selectedDate] ||
          createEmptyDay(
            selectedDate
          );

        return {
          ...previous,
          [selectedDate]: {
            ...day,
            foods: day.foods.filter(
              (food) =>
                food.id !== foodId
            ),
          },
        };
      });
    } catch (error: any) {
      console.error(error);
      alert(
        error?.message ||
        "Could not delete this food entry."
      );
    }
  }

  async function toggleDayComplete() {
    if (!user) return;

    const day =
      days[selectedDate] ||
      createEmptyDay(selectedDate);

    const completed =
      !day.completed;

    try {
      const { error } =
        await supabase
          .from("daily_logs")
          .upsert(
            {
              user_id: user.id,
              log_date: selectedDate,
              completed,
            },
            {
              onConflict:
                "user_id,log_date",
            }
          );

      if (error) throw error;

      setDays((previous) => ({
        ...previous,
        [selectedDate]: {
          ...day,
          completed,
        },
      }));
    } catch (error: any) {
      console.error(error);
      alert(
        error?.message ||
        "Could not update today's completion status."
      );
    }
  }

  async function loadOwnerData() {
    if (!user || !profile?.is_admin) return;

    setOwnerLoading(true);
    setOwnerError("");

    try {
      const [profilesResult, logsResult, foodsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: true }),

          supabase
            .from("daily_logs")
            .select("*")
            .order("log_date", { ascending: false }),

          supabase
            .from("food_entries")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

      if (profilesResult.error) throw profilesResult.error;
      if (logsResult.error) throw logsResult.error;
      if (foodsResult.error) throw foodsResult.error;

      const profiles = profilesResult.data || [];
      const logs = logsResult.data || [];
      const foods = foodsResult.data || [];

      const usersWithStats = profiles.map((person: any) => {
        const userLogs = logs.filter(
          (log: any) => log.user_id === person.id
        );

        const userFoods = foods.filter(
          (food: any) => food.user_id === person.id
        );

        return {
          ...person,
          foodCount: userFoods.length,
          totalCalories: userFoods.reduce(
            (sum: number, food: any) =>
              sum + Number(food.calories || 0),
            0
          ),
          totalProtein: userFoods.reduce(
            (sum: number, food: any) =>
              sum + Number(food.protein || 0),
            0
          ),
          totalCarbs: userFoods.reduce(
            (sum: number, food: any) =>
              sum + Number(food.carbs || 0),
            0
          ),
          totalFat: userFoods.reduce(
            (sum: number, food: any) =>
              sum + Number(food.fat || 0),
            0
          ),
          totalFiber: userFoods.reduce(
            (sum: number, food: any) =>
              sum + Number(food.fiber || 0),
            0
          ),
          totalSpending: userFoods.reduce(
            (sum: number, food: any) =>
              sum + Number(food.cost || 0),
            0
          ),
          completedDays: userLogs.filter(
            (log: any) => log.completed
          ).length,
          trackedDays: userLogs.length,
          latestActivity:
            userFoods[0]?.created_at ||
            userLogs[0]?.created_at ||
            person.created_at,
          foods: userFoods,
          logs: userLogs,
        };
      });

      setOwnerUsers(usersWithStats);
    } catch (error: any) {
      console.error(error);
      setOwnerError(
        error?.message ||
        "Could not load owner dashboard data."
      );
    } finally {
      setOwnerLoading(false);
    }
  }

  const filteredOwnerUsers = useMemo(() => {
    const query = ownerSearch.trim().toLowerCase();

    if (!query) return ownerUsers;

    return ownerUsers.filter((person: any) => {
      const username = String(person.username || "").toLowerCase();
      const id = String(person.id || "").toLowerCase();
      const email = String(person.email || "").toLowerCase();

      return (
        username.includes(query) ||
        id.includes(query) ||
        email.includes(query)
      );
    });
  }, [ownerUsers, ownerSearch]);

  useEffect(() => {
    if (!user || !profile?.is_admin || activeTab !== "owner") {
      return;
    }

    const interval = window.setInterval(() => {
      loadOwnerData();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [activeTab, profile?.is_admin, user?.id]);

  function selectDate(key: string) {
    setSelectedDate(key);
    setActiveTab("home");
  }

  function changeMonth(direction: number) {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + direction,
        1
      )
    );
  }

  function goToToday() {
    const today = new Date();

    setSelectedDate(getDateKey(today));

    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );
  }

  function openSettings() {
    setSettingsForm(goals);
    setShowSettingsModal(true);
  }

  async function saveSettings() {
    if (!user) return;

    const nextGoals: Goals = {
      calories:
        Number(settingsForm.calories) ||
        DEFAULT_GOALS.calories,

      protein:
        Number(settingsForm.protein) ||
        DEFAULT_GOALS.protein,

      carbs:
        Number(settingsForm.carbs) ||
        DEFAULT_GOALS.carbs,

      fat:
        Number(settingsForm.fat) ||
        DEFAULT_GOALS.fat,

      fiber:
        Number(settingsForm.fiber) ||
        DEFAULT_GOALS.fiber,

      budget:
        Number(settingsForm.budget) ||
        DEFAULT_GOALS.budget,
    };

    try {
      const { error } =
        await supabase
          .from("profiles")
          .update({
            calorie_goal:
              nextGoals.calories,
            protein_goal:
              nextGoals.protein,
            carbs_goal:
              nextGoals.carbs,
            fat_goal:
              nextGoals.fat,
            fiber_goal:
              nextGoals.fiber,
            budget_goal:
              nextGoals.budget,
          })
          .eq("id", user.id);

      if (error) throw error;

      setGoals(nextGoals);
      setProfile((previous: any) => ({
        ...(previous || {}),
        calorie_goal:
          nextGoals.calories,
        protein_goal:
          nextGoals.protein,
        carbs_goal:
          nextGoals.carbs,
        fat_goal:
          nextGoals.fat,
        fiber_goal:
          nextGoals.fiber,
        budget_goal:
          nextGoals.budget,
      }));

      setShowSettingsModal(false);
    } catch (error: any) {
      console.error(error);
      alert(
        error?.message ||
        "Could not save your goals."
      );
    }
  }

  function updateSetting(
    field: keyof Goals,
    value: string
  ) {
    setSettingsForm((previous) => ({
      ...previous,
      [field]: Number(value),
    }));
  }

  function renderDifference(
    difference: number,
    unit: string
  ) {
    if (difference >= 0) {
      return `${Math.round(
        difference
      )}${unit} remaining`;
    }

    return `${Math.round(
      Math.abs(difference)
    )}${unit} over`;
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(circle at top, #172554 0%, #09090b 45%, #050505 100%)",
          color: "#fff",
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: 32,
            borderRadius: 24,
            background: "rgba(255,255,255,0.06)",
            border:
              "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px",
              background:
                "linear-gradient(135deg,#f97316,#ef4444)",
              boxShadow:
                "0 14px 40px rgba(249,115,22,.28)",
            }}
          >
            <Flame size={28} />
          </div>
          <strong
            style={{
              fontSize: 22,
            }}
          >
            Loading MacroTrack...
          </strong>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background:
            "radial-gradient(circle at 15% 15%, rgba(249,115,22,.22), transparent 30%), radial-gradient(circle at 85% 85%, rgba(59,130,246,.18), transparent 30%), #070709",
          color: "#fff",
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            width: "min(440px, 100%)",
            padding: 34,
            borderRadius: 28,
            background:
              "linear-gradient(145deg, rgba(24,24,27,.96), rgba(10,10,12,.96))",
            border:
              "1px solid rgba(255,255,255,.10)",
            boxShadow:
              "0 30px 100px rgba(0,0,0,.55)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 16,
                display: "grid",
                placeItems: "center",
                background:
                  "linear-gradient(135deg,#f97316,#ef4444)",
              }}
            >
              <Flame size={25} />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 22,
                }}
              >
                MacroTrack
              </div>
              <div
                style={{
                  color: "#a1a1aa",
                  fontSize: 13,
                }}
              >
                Fuel. Track. Repeat.
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                letterSpacing: "-.8px",
              }}
            >
              {authMode === "login"
                ? "Welcome back."
                : "Create your account."}
            </h1>
            <p
              style={{
                margin:
                  "8px 0 0",
                color: "#a1a1aa",
                lineHeight: 1.5,
              }}
            >
              Your food, macros and spending —
              synced securely to your account.
            </p>
          </div>

          {authMode === "signup" && (
            <input
              value={authUsername}
              onChange={(e) =>
                setAuthUsername(
                  e.target.value
                )
              }
              placeholder="Username"
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginBottom: 12,
                padding: "14px 15px",
                borderRadius: 14,
                border:
                  "1px solid rgba(255,255,255,.10)",
                background:
                  "rgba(255,255,255,.05)",
                color: "#fff",
                outline: "none",
                fontSize: 15,
              }}
            />
          )}

          <input
            type="email"
            value={authEmail}
            onChange={(e) =>
              setAuthEmail(e.target.value)
            }
            placeholder="Email address"
            autoComplete="email"
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginBottom: 12,
              padding: "14px 15px",
              borderRadius: 14,
              border:
                "1px solid rgba(255,255,255,.10)",
              background:
                "rgba(255,255,255,.05)",
              color: "#fff",
              outline: "none",
              fontSize: 15,
            }}
          />

          <input
            type="password"
            value={authPassword}
            onChange={(e) =>
              setAuthPassword(
                e.target.value
              )
            }
            placeholder="Password"
            autoComplete={
              authMode === "login"
                ? "current-password"
                : "new-password"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAuth();
              }
            }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginBottom: 14,
              padding: "14px 15px",
              borderRadius: 14,
              border:
                "1px solid rgba(255,255,255,.10)",
              background:
                "rgba(255,255,255,.05)",
              color: "#fff",
              outline: "none",
              fontSize: 15,
            }}
          />

          {authError && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background:
                  "rgba(239,68,68,.10)",
                border:
                  "1px solid rgba(239,68,68,.25)",
                color: "#fca5a5",
                fontSize: 13,
              }}
            >
              {authError}
            </div>
          )}

          {authMessage && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background:
                  "rgba(34,197,94,.10)",
                border:
                  "1px solid rgba(34,197,94,.25)",
                color: "#86efac",
                fontSize: 13,
              }}
            >
              {authMessage}
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={authBusy}
            style={{
              width: "100%",
              border: 0,
              borderRadius: 14,
              padding: "14px 16px",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              cursor: authBusy
                ? "wait"
                : "pointer",
              background:
                "linear-gradient(135deg,#f97316,#ef4444)",
              opacity: authBusy ? 0.65 : 1,
              boxShadow:
                "0 12px 30px rgba(249,115,22,.22)",
            }}
          >
            {authBusy
              ? "Please wait..."
              : authMode === "login"
              ? "Log in"
              : "Create account"}
          </button>

          <button
            onClick={() => {
              setAuthMode(
                authMode === "login"
                  ? "signup"
                  : "login"
              );
              setAuthError("");
              setAuthMessage("");
            }}
            style={{
              width: "100%",
              marginTop: 12,
              border: 0,
              background: "transparent",
              color: "#a1a1aa",
              padding: 10,
              cursor: "pointer",
            }}
          >
            {authMode === "login"
              ? "New here? Create an account"
              : "Already have an account? Log in"}
          </button>

          <div
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop:
                "1px solid rgba(255,255,255,.08)",
              color: "#71717a",
              fontSize: 12,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            MacroTrack stores your tracking data
            in your private account.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-mark">
            <Flame
              size={22}
              strokeWidth={2.6}
            />
          </div>

          <div>
            <div className="brand-name">
              MacroTrack
            </div>

            <div className="brand-tagline">
              Fuel. Track. Repeat.
            </div>
          </div>

        </div>

        <nav className="sidebar-nav">

          <button
            className={`nav-item ${
              activeTab === "home"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("home")
            }
          >
            <Home size={19} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-item ${
              activeTab === "calendar"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("calendar")
            }
          >
            <CalendarDays size={19} />
            <span>Calendar</span>
          </button>

          <button
            className={`nav-item ${
              activeTab === "analytics"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("analytics")
            }
          >
            <TrendingUp size={19} />
            <span>Analytics</span>
          </button>

          <button
            className={`nav-item ${
              activeTab === "achievements"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("achievements")
            }
          >
            <Trophy size={19} />
            <span>Achievements</span>
          </button>

          {profile?.is_admin && (
            <button
              className={`nav-item ${
                activeTab === "owner"
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                setActiveTab("owner");
                loadOwnerData();
              }}
            >
              <ShieldCheck size={19} />
              <span>Owner</span>
            </button>
          )}

        </nav>

        <div className="sidebar-bottom">

          <button
            className="nav-item"
            onClick={openSettings}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="profile-card">

            <div className="profile-avatar">
              {(
                profile?.username ||
                user?.email ||
                "U"
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="profile-info">

              <strong>
                {profile?.username ||
                  user?.email?.split("@")[0] ||
                  "Your Profile"}
              </strong>

              <span>
                MacroTrack Member
              </span>

            </div>

            <button
              className="icon-button"
              title="Log out"
              onClick={handleSignOut}
              aria-label="Log out"
            >
              <LogOut size={18} />
            </button>

          </div>

        </div>

      </aside>

      <main className="main-content">

        <header className="topbar">

          <div>

            <div className="mobile-brand">

              <div className="brand-mark">
                <Flame size={19} />
              </div>

              <strong>
                MacroTrack
              </strong>

            </div>

            <div className="eyebrow">

              {selectedDate === todayKey
                ? "TODAY'S NUTRITION"
                : "DAILY NUTRITION"}

            </div>

            <h1>
              {formatDate(selectedDate)}
            </h1>

          </div>

          <div className="topbar-actions">

            <button
              className="today-button"
              onClick={goToToday}
            >
              <CalendarDays size={17} />
              Today
            </button>

            <button
              className="profile-button"
              onClick={openSettings}
            >
              <div className="small-avatar">
                K
              </div>
            </button>

          </div>

        </header>

        {activeTab === "home" && (
          <>

            <section className="hero-grid">

              <div
                className={`hero-card calorie-card ${
                  calorieDifference < 0
                    ? "over-goal-card"
                    : ""
                }`}
              >

                <div className="hero-card-top">

                  <div>

                    <span className="metric-label">
                      CALORIES
                    </span>

                    <div className="big-number">
                      {Math.round(
                        totals.calories
                      )}

                      <span>
                        {" "}kcal
                      </span>
                    </div>

                  </div>

                  <div className="metric-icon orange">
                    <Flame size={23} />
                  </div>

                </div>

                <div className="progress-track">

                  <div
                    className={`progress-fill orange-fill ${
                      calorieDifference < 0
                        ? "over-fill"
                        : ""
                    }`}
                    style={{
                      width:
                        `${getProgressWidth(
                          totals.calories,
                          goals.calories
                        )}%`,
                    }}
                  />

                </div>

                <div className="metric-footer">

                  <span>
                    {Math.round(
                      totals.calories
                    )}{" "}
                    of {goals.calories} kcal
                  </span>

                  <span
                    className={
                      calorieDifference < 0
                        ? "over-text"
                        : ""
                    }
                  >
                    {renderDifference(
                      calorieDifference,
                      " kcal"
                    )}
                  </span>

                </div>

                <div className="percentage-label">
                  {getPercentage(
                    totals.calories,
                    goals.calories
                  )}
                  % of target
                </div>

              </div>

              <div
                className={`hero-card protein-card ${
                  proteinDifference < 0
                    ? "over-goal-card"
                    : ""
                }`}
              >

                <div className="hero-card-top">

                  <div>

                    <span className="metric-label">
                      PROTEIN
                    </span>

                    <div className="big-number">
                      {Math.round(
                        totals.protein
                      )}

                      <span>
                        {" "}g
                      </span>
                    </div>

                  </div>

                  <div className="metric-icon purple">
                    <Target size={23} />
                  </div>

                </div>

                <div className="progress-track">

                  <div
                    className="progress-fill purple-fill"
                    style={{
                      width:
                        `${getProgressWidth(
                          totals.protein,
                          goals.protein
                        )}%`,
                    }}
                  />

                </div>

                <div className="metric-footer">

                  <span>
                    {Math.round(
                      totals.protein
                    )}{" "}
                    of {goals.protein} g
                  </span>

                  <span
                    className={
                      proteinDifference < 0
                        ? "over-text"
                        : ""
                    }
                  >
                    {renderDifference(
                      proteinDifference,
                      "g"
                    )}
                  </span>

                </div>

                <div className="percentage-label">
                  {getPercentage(
                    totals.protein,
                    goals.protein
                  )}
                  % of target
                </div>

              </div>

              <div
                className={`hero-card budget-card ${
                  budgetDifference < 0
                    ? "over-goal-card"
                    : ""
                }`}
              >

                <div className="hero-card-top">

                  <div>

                    <span className="metric-label">
                      FOOD SPENDING
                    </span>

                    <div className="big-number">
                      ₹
                      {Math.round(
                        totals.cost
                      )}
                    </div>

                  </div>

                  <div className="metric-icon green">
                    <Wallet size={23} />
                  </div>

                </div>

                <div className="progress-track">

                  <div
                    className={`progress-fill green-fill ${
                      budgetDifference < 0
                        ? "over-fill"
                        : ""
                    }`}
                    style={{
                      width:
                        `${getProgressWidth(
                          totals.cost,
                          goals.budget
                        )}%`,
                    }}
                  />

                </div>

                <div className="metric-footer">

                  <span>
                    Budget ₹
                    {goals.budget}
                  </span>

                  <span
                    className={
                      budgetDifference < 0
                        ? "over-text"
                        : ""
                    }
                  >
                    {budgetDifference >= 0
                      ? `₹${Math.round(
                          budgetDifference
                        )} left`
                      : `₹${Math.round(
                          Math.abs(
                            budgetDifference
                          )
                        )} over`}
                  </span>

                </div>

                <div className="percentage-label">
                  {getPercentage(
                    totals.cost,
                    goals.budget
                  )}
                  % of budget
                </div>

              </div>

            </section>

            <section className="macro-row">

              <div
                className={`macro-mini-card ${
                  carbsDifference < 0
                    ? "macro-over"
                    : ""
                }`}
              >

                <div className="macro-mini-header">

                  <span className="macro-dot blue" />

                  <span>
                    Carbs
                  </span>

                </div>

                <strong>
                  {Math.round(
                    totals.carbs
                  )}g
                </strong>

                <span className="macro-goal">
                  / {goals.carbs}g
                </span>

                <div className="mini-track">

                  <div
                    className="mini-fill blue-fill"
                    style={{
                      width:
                        `${getProgressWidth(
                          totals.carbs,
                          goals.carbs
                        )}%`,
                    }}
                  />

                </div>

                <small
                  className={
                    carbsDifference < 0
                      ? "over-text"
                      : ""
                  }
                >
                  {renderDifference(
                    carbsDifference,
                    "g"
                  )}
                </small>

              </div>

              <div
                className={`macro-mini-card ${
                  fatDifference < 0
                    ? "macro-over"
                    : ""
                }`}
              >

                <div className="macro-mini-header">

                  <span className="macro-dot pink" />

                  <span>
                    Fat
                  </span>

                </div>

                <strong>
                  {Math.round(
                    totals.fat
                  )}g
                </strong>

                <span className="macro-goal">
                  / {goals.fat}g
                </span>

                <div className="mini-track">

                  <div
                    className="mini-fill pink-fill"
                    style={{
                      width:
                        `${getProgressWidth(
                          totals.fat,
                          goals.fat
                        )}%`,
                    }}
                  />

                </div>

                <small
                  className={
                    fatDifference < 0
                      ? "over-text"
                      : ""
                  }
                >
                  {renderDifference(
                    fatDifference,
                    "g"
                  )}
                </small>

              </div>

              <div
                className={`macro-mini-card ${
                  fiberDifference < 0
                    ? "macro-over"
                    : ""
                }`}
              >

                <div className="macro-mini-header">

                  <span className="macro-dot green-dot" />

                  <span>
                    Fiber
                  </span>

                </div>

                <strong>
                  {Math.round(
                    totals.fiber
                  )}g
                </strong>

                <span className="macro-goal">
                  / {goals.fiber}g
                </span>

                <div className="mini-track">

                  <div
                    className="mini-fill green-fill"
                    style={{
                      width:
                        `${getProgressWidth(
                          totals.fiber,
                          goals.fiber
                        )}%`,
                    }}
                  />

                </div>

                <small
                  className={
                    fiberDifference < 0
                      ? "over-text"
                      : ""
                  }
                >
                  {renderDifference(
                    fiberDifference,
                    "g"
                  )}
                </small>

              </div>

            </section>

            <section className="content-grid">

              <div className="food-section">

                <div className="section-heading">

                  <div>

                    <span className="eyebrow">
                      FOOD JOURNAL
                    </span>

                    <h2>
                      Today's food
                    </h2>

                  </div>

                  <button
                    className="add-food-button"
                    onClick={openAddFood}
                  >
                    <Plus size={18} />
                    Add food
                  </button>

                </div>

                {currentDay.foods.length === 0 ? (

                  <div className="empty-state">

                    <div className="empty-icon">
                      <Utensils size={28} />
                    </div>

                    <h3>
                      No food logged yet
                    </h3>

                    <p>
                      Start your day by adding
                      your first food.
                    </p>

                    <button
                      className="empty-add-button"
                      onClick={openAddFood}
                    >
                      <Plus size={17} />
                      Add your first food
                    </button>

                  </div>

                ) : (

                  <div className="food-list">

                    {currentDay.foods.map(
                      (food) => (

                        <article
                          className="food-card"
                          key={food.id}
                        >

                          <div className="food-main">

                            <div className="food-icon">
                              <Utensils size={19} />
                            </div>

                            <div className="food-title">

                              <h3>
                                {food.name}
                              </h3>

                              <span>
                                {food.quantity}
                              </span>

                              <div className="food-time">

                                <Clock3 size={13} />

                                <span>
                                  Logged{" "}
                                  {formatTime(
                                    food.createdAt
                                  )}
                                </span>

                              </div>

                            </div>

                          </div>

                          <div className="food-nutrition">

                            <div>
                              <strong>
                                {Math.round(
                                  food.calories
                                )}
                              </strong>
                              <span>
                                kcal
                              </span>
                            </div>

                            <div>
                              <strong>
                                {Math.round(
                                  food.protein
                                )}g
                              </strong>
                              <span>
                                protein
                              </span>
                            </div>

                            <div>
                              <strong>
                                {Math.round(
                                  food.carbs
                                )}g
                              </strong>
                              <span>
                                carbs
                              </span>
                            </div>

                            <div>
                              <strong>
                                {Math.round(
                                  food.fat
                                )}g
                              </strong>
                              <span>
                                fat
                              </span>
                            </div>

                            <div>
                              <strong>
                                {Math.round(
                                  food.fiber
                                )}g
                              </strong>
                              <span>
                                fiber
                              </span>
                            </div>

                          </div>

                          <div className="food-cost">
                            <span>
                              ₹
                              {Math.round(
                                food.cost
                              )}
                            </span>
                          </div>

                          <div className="food-actions">

                            <button
                              onClick={() =>
                                openEditFood(food)
                              }
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              onClick={() =>
                                deleteFood(
                                  food.id
                                )
                              }
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>

                          </div>

                        </article>

                      )
                    )}

                  </div>

                )}

                <div className="day-complete-card">

                  <div className="day-complete-icon">

                    {currentDay.completed ? (
                      <CircleCheck size={24} />
                    ) : (
                      <Sparkles size={24} />
                    )}

                  </div>

                  <div>

                    <strong>

                      {currentDay.completed
                        ? "Day completed"
                        : "Ready to wrap up?"}

                    </strong>

                    <p>

                      {currentDay.completed
                        ? "You can still edit this day anytime."
                        : "Mark the day complete when you're done logging."}

                    </p>

                  </div>

                  <button
                    className={`complete-button ${
                      currentDay.completed
                        ? "completed"
                        : ""
                    }`}
                    onClick={
                      toggleDayComplete
                    }
                  >

                    {currentDay.completed
                      ? "Completed ✓"
                      : "That's a wrap"}

                  </button>

                </div>

              </div>

              <aside className="right-column">

                <div className="calendar-card">

                  <div className="calendar-header">

                    <div>

                      <span className="eyebrow">
                        HISTORY
                      </span>

                      <h3>
                        {getMonthName(
                          currentMonth
                        )}
                      </h3>

                    </div>

                    <div className="calendar-arrows">

                      <button
                        onClick={() =>
                          changeMonth(-1)
                        }
                      >
                        <ChevronLeft size={17} />
                      </button>

                      <button
                        onClick={() =>
                          changeMonth(1)
                        }
                      >
                        <ChevronRight size={17} />
                      </button>

                    </div>

                  </div>

                  <div className="calendar-weekdays">

                    {weekdayLabels.map(
                      (day) => (
                        <span key={day}>
                          {day}
                        </span>
                      )
                    )}

                  </div>

                  <div className="calendar-grid">

                    {calendarCells.map(
                      (day, index) => {

                        if (!day) {
                          return (
                            <div
                              className="calendar-empty"
                              key={`empty-${index}`}
                            />
                          );
                        }

                        const key =
                          getDateKey(
                            new Date(
                              currentMonth.getFullYear(),
                              currentMonth.getMonth(),
                              day
                            )
                          );

                        const dayData =
                          days[key];

                        const isSelected =
                          key === selectedDate;

                        const isToday =
                          key === todayKey;

                        return (
                          <button
                            key={key}
                            className={`calendar-day ${
                              isSelected
                                ? "selected"
                                : ""
                            } ${
                              isToday
                                ? "today"
                                : ""
                            }`}
                            onClick={() =>
                              selectDate(key)
                            }
                          >

                            <span>
                              {day}
                            </span>

                            {dayData?.foods
                              .length ? (
                              <i />
                            ) : null}

                          </button>
                        );
                      }
                    )}

                  </div>

                  <button
                    className="calendar-today"
                    onClick={goToToday}
                  >
                    Go to today
                  </button>

                </div>

                <div className="streak-card">

                  <div className="streak-glow">
                    <Flame size={27} />
                  </div>

                  <div>

                    <span>
                      TRACKING STREAK
                    </span>

                    <strong>
                      {trackingStreak} {
                        trackingStreak === 1
                          ? "day"
                          : "days"
                      }
                    </strong>

                    <p>
                      {trackingStreak > 0
                    ? "Keep showing up."
                    : "Complete today to start your streak."}
                    </p>

                  </div>

                </div>

                <div className="tip-card">

                  <div className="tip-icon">
                    <Heart size={18} />
                  </div>

                  <div>

                    <span>
                      DAILY NOTE
                    </span>

                    <p>
                      Consistency beats
                      perfection. Log what
                      you actually eat.
                    </p>

                  </div>

                </div>

              </aside>

            </section>

          </>
        )}

        {activeTab === "calendar" && (

          <section className="full-page-section">

            <div className="page-heading">

              <div>

                <span className="eyebrow">
                  YOUR HISTORY
                </span>

                <h2>
                  Nutrition calendar
                </h2>

                <p>
                  Select any day to review
                  or edit your food journal.
                </p>

              </div>

              <button
                className="today-button"
                onClick={goToToday}
              >
                <CalendarDays size={17} />
                Today
              </button>

            </div>

            <div className="large-calendar-card">

              <div className="large-calendar-header">

                <button
                  onClick={() =>
                    changeMonth(-1)
                  }
                >
                  <ChevronLeft size={19} />
                </button>

                <h2>
                  {getMonthName(
                    currentMonth
                  )}
                </h2>

                <button
                  onClick={() =>
                    changeMonth(1)
                  }
                >
                  <ChevronRight size={19} />
                </button>

              </div>

              <div className="large-calendar-weekdays">

                {weekdayLabels.map(
                  (day) => (
                    <span key={day}>
                      {day}
                    </span>
                  )
                )}

              </div>

              <div className="large-calendar-grid">

                {calendarCells.map(
                  (day, index) => {

                    if (!day) {
                      return (
                        <div
                          className="large-calendar-empty"
                          key={`empty-large-${index}`}
                        />
                      );
                    }

                    const key =
                      getDateKey(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth(),
                          day
                        )
                      );

                    const dayData =
                      days[key];

                    const isSelected =
                      key === selectedDate;

                    const isToday =
                      key === todayKey;

                    return (
                      <button
                        key={key}
                        className={`large-calendar-day ${
                          isSelected
                            ? "selected"
                            : ""
                        } ${
                          isToday
                            ? "today"
                            : ""
                        }`}
                        onClick={() =>
                          selectDate(key)
                        }
                      >

                        <span className="large-day-number">
                          {day}
                        </span>

                        {dayData?.foods
                          .length ? (

                          <span className="calendar-summary">

                            {dayData.foods.length}{" "}
                            item
                            {dayData.foods
                              .length > 1
                              ? "s"
                              : ""}

                          </span>

                        ) : (

                          <span className="calendar-summary muted">
                            No entries
                          </span>

                        )}

                        {dayData?.completed && (

                          <CircleCheck
                            className="calendar-completed"
                            size={17}
                          />

                        )}

                      </button>
                    );
                  }
                )}

              </div>

            </div>

          </section>

        )}

        {activeTab === "analytics" && (

          <section className="full-page-section">

            <div className="page-heading">

              <div>

                <span className="eyebrow">
                  YOUR NUMBERS
                </span>

                <h2>
                  Analytics
                </h2>

                <p>
                  Your last 7 days of nutrition,
                  protein and food spending.
                </p>

              </div>

              <div className="analytics-period-badge">
                LAST 7 DAYS
              </div>

            </div>

            <div className="analytics-grid">

              <div className="analytics-card">
                <span>Food items logged</span>
                <strong>{totalFoodItems}</strong>
                <small>Across all saved days</small>
              </div>

              <div className="analytics-card">
                <span>Total spending</span>
                <strong>₹{Math.round(totalSpending)}</strong>
                <small>Across all saved days</small>
              </div>

              <div className="analytics-card">
                <span>Days completed</span>
                <strong>{completedDays}</strong>
                <small>Completed nutrition logs</small>
              </div>

              <div className="analytics-card">
                <span>Current streak</span>
                <strong>{trackingStreak} {trackingStreak === 1 ? "day" : "days"}</strong>
                <small>Consecutive completed days</small>
              </div>

            </div>

            <div className="analytics-summary-grid">

              <div className="analytics-summary-card">
                <span>7-day average calories</span>
                <strong>{weeklySummary.averageCalories} kcal</strong>
                <small>Goal: {goals.calories} kcal/day</small>
              </div>

              <div className="analytics-summary-card">
                <span>7-day average protein</span>
                <strong>{weeklySummary.averageProtein} g</strong>
                <small>Goal: {goals.protein} g/day</small>
              </div>

              <div className="analytics-summary-card">
                <span>7-day average spending</span>
                <strong>₹{weeklySummary.averageSpending}</strong>
                <small>Budget: ₹{goals.budget}/day</small>
              </div>

              <div className="analytics-summary-card">
                <span>Completed this week</span>
                <strong>{weeklySummary.completed}/7</strong>
                <small>Days wrapped up</small>
              </div>

            </div>

            <div className="analytics-chart-card">

              <div className="analytics-chart-header">
                <div>
                  <span className="eyebrow">
                    PERFORMANCE
                  </span>
                  <h3>Calories · last 7 days</h3>
                </div>

                <span className="analytics-goal-label">
                  Target {goals.calories} kcal
                </span>
              </div>

              <div className="bar-chart">

                {weeklyAnalytics.map((day) => {
                  const height = day.calories
                    ? Math.max(
                        8,
                        Math.min(
                          100,
                          (day.calories / Math.max(goals.calories, 1)) * 100
                        )
                      )
                    : 4;

                  return (
                    <div className="bar-column" key={day.key}>

                      <span className="bar-value">
                        {day.calories
                          ? Math.round(day.calories)
                          : "—"}
                      </span>

                      <div className="bar-track">
                        <div
                          className={`bar-fill ${
                            day.completed ? "bar-completed" : ""
                          }`}
                          style={{ height: `${height}%` }}
                        />
                      </div>

                      <span className="bar-label">
                        {day.label}
                      </span>

                      {day.completed && (
                        <CircleCheck
                          className="bar-check"
                          size={13}
                        />
                      )}

                    </div>
                  );
                })}

              </div>

            </div>

            <div className="analytics-bottom-grid">

              <div className="analytics-chart-card">

                <div className="analytics-chart-header">
                  <div>
                    <span className="eyebrow">
                      PROTEIN
                    </span>
                    <h3>Protein intake</h3>
                  </div>

                  <span className="analytics-goal-label">
                    Target {goals.protein} g
                  </span>
                </div>

                <div className="metric-chart-list">

                  {weeklyAnalytics.map((day) => {
                    const width = day.protein
                      ? Math.min(
                          100,
                          (day.protein / Math.max(goals.protein, 1)) * 100
                        )
                      : 0;

                    return (
                      <div className="metric-chart-row" key={day.key}>

                        <span className="metric-chart-day">
                          {day.label}
                        </span>

                        <div className="metric-chart-track">
                          <div
                            className="metric-chart-fill protein-chart-fill"
                            style={{ width: `${width}%` }}
                          />
                        </div>

                        <strong>
                          {Math.round(day.protein)}g
                        </strong>

                      </div>
                    );
                  })}

                </div>

              </div>

              <div className="analytics-chart-card">

                <div className="analytics-chart-header">
                  <div>
                    <span className="eyebrow">
                      SPENDING
                    </span>
                    <h3>Food spending</h3>
                  </div>

                  <span className="analytics-goal-label">
                    Budget ₹{goals.budget}/day
                  </span>
                </div>

                <div className="metric-chart-list">

                  {weeklyAnalytics.map((day) => {
                    const width = day.spending
                      ? Math.min(
                          100,
                          (day.spending / Math.max(goals.budget, 1)) * 100
                        )
                      : 0;

                    return (
                      <div className="metric-chart-row" key={day.key}>

                        <span className="metric-chart-day">
                          {day.label}
                        </span>

                        <div className="metric-chart-track">
                          <div
                            className="metric-chart-fill spending-chart-fill"
                            style={{ width: `${width}%` }}
                          />
                        </div>

                        <strong>
                          ₹{Math.round(day.spending)}
                        </strong>

                      </div>
                    );
                  })}

                </div>

              </div>

            </div>

          </section>

        )}

        {activeTab === "achievements" && (

          <section className="full-page-section">

            <div className="page-heading">

              <div>

                <span className="eyebrow">
                  LEVEL UP
                </span>

                <h2>
                  Achievements
                </h2>

                <p>
                  Turn consistency into progress.
                </p>

              </div>

            </div>

            <div className="achievement-grid">

              <div className="achievement-card unlocked">

                <div className="achievement-icon">
                  <Flame size={25} />
                </div>

                <div>

                  <span>
                    FIRST LOG
                  </span>

                  <h3>
                    First meal logged
                  </h3>

                  <p>
                    You started tracking
                    your nutrition.
                  </p>

                </div>

                <CircleCheck size={21} />

              </div>

              <div className="achievement-card">

                <div className="achievement-icon muted-icon">
                  <Trophy size={25} />
                </div>

                <div>

                  <span>
                    CONSISTENCY
                  </span>

                  <h3>
                    7 day streak
                  </h3>

                  <p>
                    Track your food for
                    seven consecutive days.
                  </p>

                </div>

              </div>

              <div className="achievement-card">

                <div className="achievement-icon muted-icon">
                  <Target size={25} />
                </div>

                <div>

                  <span>
                    PROTEIN
                  </span>

                  <h3>
                    Protein beast
                  </h3>

                  <p>
                    Hit your protein goal
                    ten times.
                  </p>

                </div>

              </div>

              <div className="achievement-card">

                <div className="achievement-icon muted-icon">
                  <Wallet size={25} />
                </div>

                <div>

                  <span>
                    BUDGET
                  </span>

                  <h3>
                    Budget king
                  </h3>

                  <p>
                    Stay under your daily
                    budget for seven days.
                  </p>

                </div>

              </div>

            </div>

          </section>

        )}

        {activeTab === "owner" && profile?.is_admin && (

          <section className="full-page-section">

            <div className="page-heading">
              <div>
                <span className="eyebrow">OWNER CONTROL CENTER</span>
                <h2>MacroTrack users</h2>
                <p>
                  Monitor MacroTrack activity and nutrition data for registered users.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="today-button"
                  onClick={loadOwnerData}
                  disabled={ownerLoading}
                >
                  {ownerLoading ? "Refreshing..." : "Refresh data"}
                </button>

                <button
                  className="today-button"
                  onClick={() => {
                    const rows = ownerUsers.map((person) => ({
                      username: person.username || "",
                      user_id: person.id,
                      joined: person.created_at || "",
                      food_items: person.foodCount,
                      calories: Math.round(person.totalCalories),
                      protein_g: Math.round(person.totalProtein),
                      carbs_g: Math.round(person.totalCarbs),
                      fat_g: Math.round(person.totalFat),
                      fiber_g: Math.round(person.totalFiber),
                      spending_inr: Math.round(person.totalSpending),
                      tracked_days: person.trackedDays,
                      completed_days: person.completedDays,
                    }));

                    const headers = Object.keys(
                      rows[0] || {
                        username: "",
                        user_id: "",
                        joined: "",
                        food_items: "",
                        calories: "",
                        protein_g: "",
                        carbs_g: "",
                        fat_g: "",
                        fiber_g: "",
                        spending_inr: "",
                        tracked_days: "",
                        completed_days: "",
                      }
                    );

                    const escapeCsv = (value: any) =>
                      `"${String(value ?? "").replace(/"/g, '""')}"`;

                    const csv = [
                      headers.join(","),
                      ...rows.map((row) =>
                        headers
                          .map((header) =>
                            escapeCsv((row as any)[header])
                          )
                          .join(",")
                      ),
                    ].join("\n");

                    const blob = new Blob([csv], {
                      type: "text/csv;charset=utf-8;",
                    });

                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `macrotrack-owner-${getDateKey(
                      new Date()
                    )}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {ownerError && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  marginBottom: 20,
                  background: "rgba(239,68,68,.12)",
                  border: "1px solid rgba(239,68,68,.28)",
                  color: "#fecaca",
                }}
              >
                {ownerError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              <input
                value={ownerSearch}
                onChange={(event) =>
                  setOwnerSearch(event.target.value)
                }
                placeholder="Search username..."
                aria-label="Search users by username"
                style={{
                  flex: "1 1 360px",
                  minWidth: 240,
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.05)",
                  color: "#fff",
                  outline: "none",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />

              {ownerSearch && (
                <button
                  className="today-button"
                  onClick={() => setOwnerSearch("")}
                >
                  Clear search
                </button>
              )}
            </div>

            <div className="analytics-summary-grid">
              <div className="analytics-summary-card">
                <span>REGISTERED USERS</span>
                <strong>{filteredOwnerUsers.length}</strong>
                <p>{ownerSearch ? "Users matching search" : "Total MacroTrack accounts"}</p>
              </div>

              <div className="analytics-summary-card">
                <span>FOOD ITEMS</span>
                <strong>
                  {ownerUsers.reduce(
                    (sum, person) => sum + person.foodCount,
                    0
                  )}
                </strong>
                <p>Total entries across users</p>
              </div>

              <div className="analytics-summary-card">
                <span>CALORIES LOGGED</span>
                <strong>
                  {Math.round(
                    ownerUsers.reduce(
                      (sum, person) => sum + person.totalCalories,
                      0
                    )
                  )}
                </strong>
                <p>Total calories entered</p>
              </div>

              <div className="analytics-summary-card">
                <span>TOTAL SPENDING</span>
                <strong>
                  ₹{Math.round(
                    ownerUsers.reduce(
                      (sum, person) => sum + person.totalSpending,
                      0
                    )
                  )}
                </strong>
                <p>Total food spending entered</p>
              </div>
            </div>

            {(() => {
              const totalCompletedDays = ownerUsers.reduce(
                (sum, person) => sum + person.completedDays,
                0
              );
              const totalTrackedDays = ownerUsers.reduce(
                (sum, person) => sum + person.trackedDays,
                0
              );
              const totalProtein = ownerUsers.reduce(
                (sum, person) => sum + person.totalProtein,
                0
              );
              const totalCarbs = ownerUsers.reduce(
                (sum, person) => sum + person.totalCarbs,
                0
              );
              const totalFat = ownerUsers.reduce(
                (sum, person) => sum + person.totalFat,
                0
              );
              const totalFiber = ownerUsers.reduce(
                (sum, person) => sum + person.totalFiber,
                0
              );

              const activeLast7 = ownerUsers.filter((person) => {
                if (!person.latestActivity) return false;
                return (
                  Date.now() -
                    new Date(person.latestActivity).getTime() <=
                  7 * 24 * 60 * 60 * 1000
                );
              }).length;

              const activeLast30 = ownerUsers.filter((person) => {
                if (!person.latestActivity) return false;
                return (
                  Date.now() -
                    new Date(person.latestActivity).getTime() <=
                  30 * 24 * 60 * 60 * 1000
                );
              }).length;

              const completionRate = totalTrackedDays
                ? Math.round(
                    (totalCompletedDays / totalTrackedDays) * 100
                  )
                : 0;

              const topUsers = [...ownerUsers]
                .sort((a, b) => b.foodCount - a.foodCount)
                .slice(0, 5);

              const maxFoodCount = Math.max(
                1,
                ...topUsers.map((person) => person.foodCount)
              );

              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(220px,1fr))",
                    gap: 14,
                    marginTop: 18,
                    marginBottom: 24,
                  }}
                >
                  <div className="analytics-chart-card" style={{ padding: 20 }}>
                    <span className="eyebrow">ACTIVE USERS • 7 DAYS</span>
                    <strong style={{ fontSize: 30 }}>
                      {activeLast7}
                    </strong>
                    <p style={{ opacity: 0.65 }}>
                      Users with recent tracking activity.
                    </p>
                  </div>

                  <div className="analytics-chart-card" style={{ padding: 20 }}>
                    <span className="eyebrow">ACTIVE USERS • 30 DAYS</span>
                    <strong style={{ fontSize: 30 }}>
                      {activeLast30}
                    </strong>
                    <p style={{ opacity: 0.65 }}>
                      Users active in the last month.
                    </p>
                  </div>

                  <div className="analytics-chart-card" style={{ padding: 20 }}>
                    <span className="eyebrow">COMPLETION RATE</span>
                    <strong style={{ fontSize: 30 }}>
                      {completionRate}%
                    </strong>
                    <p style={{ opacity: 0.65 }}>
                      Completed tracked days across accounts.
                    </p>
                  </div>

                  <div className="analytics-chart-card" style={{ padding: 20 }}>
                    <span className="eyebrow">PROTEIN LOGGED</span>
                    <strong style={{ fontSize: 30 }}>
                      {Math.round(totalProtein)}g
                    </strong>
                    <p style={{ opacity: 0.65 }}>
                      Total protein entered by customers.
                    </p>
                  </div>

                  <div
                    className="analytics-chart-card"
                    style={{
                      padding: 20,
                      gridColumn: "1 / -1",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                        alignItems: "center",
                        marginBottom: 18,
                      }}
                    >
                      <div>
                        <span className="eyebrow">CUSTOMER ACTIVITY</span>
                        <h3 style={{ margin: "6px 0 0" }}>
                          Most active trackers
                        </h3>
                      </div>

                      <div style={{ opacity: 0.65, fontSize: 13 }}>
                        {Math.round(totalCarbs)}g carbs •{" "}
                        {Math.round(totalFat)}g fat •{" "}
                        {Math.round(totalFiber)}g fiber
                      </div>
                    </div>

                    {topUsers.length === 0 ? (
                      <div style={{ opacity: 0.6 }}>
                        No customer activity yet.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        {topUsers.map((person) => (
                          <div key={person.id}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                                marginBottom: 6,
                                fontSize: 13,
                              }}
                            >
                              <strong>
                                {person.username || "MacroTrack User"}
                              </strong>
                              <span style={{ opacity: 0.65 }}>
                                {person.foodCount} food entries
                              </span>
                            </div>

                            <div
                              style={{
                                height: 8,
                                borderRadius: 999,
                                background: "rgba(255,255,255,.07)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${Math.max(
                                    4,
                                    (person.foodCount / maxFoodCount) * 100
                                  )}%`,
                                  borderRadius: 999,
                                  background:
                                    "linear-gradient(90deg,#f97316,#8b5cf6)",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div
              style={{
                display: "grid",
                gap: 14,
                marginTop: 24,
              }}
            >
              {ownerLoading && ownerUsers.length === 0 && (
                <div className="analytics-chart-card">
                  Loading users...
                </div>
              )}

              {!ownerLoading && filteredOwnerUsers.length === 0 && (
                <div className="analytics-chart-card">
                  {ownerSearch
                    ? `No users match "${ownerSearch}".`
                    : "No users found yet."}
                </div>
              )}

              {filteredOwnerUsers.map((person) => {
                const isOpen = selectedOwnerId === person.id;

                const foodsByDate = [...person.foods].sort(
                  (a: any, b: any) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                );

                return (
                  <div
                    key={person.id}
                    className="analytics-chart-card"
                    style={{ padding: 22 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 18,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div className="small-avatar">
                          {(person.username || person.id || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong style={{ fontSize: 18 }}>
                            {person.username || "MacroTrack User"}
                          </strong>

                          <div
                            style={{
                              opacity: 0.6,
                              marginTop: 4,
                              fontSize: 13,
                            }}
                          >
                            {person.id === user?.id
                              ? "You • Owner"
                              : "MacroTrack member"}{" "}
                            • Joined{" "}
                            {new Date(
                              person.created_at
                            ).toLocaleDateString("en-IN")}
                          </div>
                        </div>
                      </div>

                      <button
                        className="today-button"
                        onClick={() =>
                          setSelectedOwnerId(
                            isOpen ? null : person.id
                          )
                        }
                      >
                        {isOpen
                          ? "Hide details"
                          : "View full details"}
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(135px,1fr))",
                        gap: 10,
                        marginTop: 20,
                      }}
                    >
                      <div className="analytics-summary-card">
                        <span>FOOD</span>
                        <strong>{person.foodCount}</strong>
                      </div>

                      <div className="analytics-summary-card">
                        <span>CALORIES</span>
                        <strong>
                          {Math.round(person.totalCalories)}
                        </strong>
                      </div>

                      <div className="analytics-summary-card">
                        <span>PROTEIN</span>
                        <strong>
                          {Math.round(person.totalProtein)}g
                        </strong>
                      </div>

                      <div className="analytics-summary-card">
                        <span>CARBS</span>
                        <strong>
                          {Math.round(person.totalCarbs)}g
                        </strong>
                      </div>

                      <div className="analytics-summary-card">
                        <span>FAT</span>
                        <strong>
                          {Math.round(person.totalFat)}g
                        </strong>
                      </div>

                      <div className="analytics-summary-card">
                        <span>FIBER</span>
                        <strong>
                          {Math.round(person.totalFiber)}g
                        </strong>
                      </div>

                      <div className="analytics-summary-card">
                        <span>SPENDING</span>
                        <strong>
                          ₹{Math.round(person.totalSpending)}
                        </strong>
                      </div>

                      <div className="analytics-summary-card">
                        <span>TRACKED DAYS</span>
                        <strong>{person.trackedDays}</strong>
                      </div>

                      <div className="analytics-summary-card">
                        <span>COMPLETED</span>
                        <strong>{person.completedDays}</strong>
                      </div>
                    </div>

                    {isOpen && (
                      <div
                        style={{
                          marginTop: 22,
                          paddingTop: 22,
                          borderTop:
                            "1px solid rgba(255,255,255,.08)",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(180px,1fr))",
                            gap: 12,
                            marginBottom: 20,
                          }}
                        >
                          <div className="analytics-chart-card">
                            <span className="eyebrow">
                              LATEST ACTIVITY
                            </span>
                            <strong>
                              {person.latestActivity
                                ? new Date(
                                    person.latestActivity
                                  ).toLocaleString("en-IN")
                                : "No activity"}
                            </strong>
                          </div>

                          <div className="analytics-chart-card">
                            <span className="eyebrow">
                              COMPLETION RATE
                            </span>
                            <strong>
                              {person.trackedDays
                                ? Math.round(
                                    (person.completedDays /
                                      person.trackedDays) *
                                      100
                                  )
                                : 0}
                              %
                            </strong>
                          </div>
                        </div>

                        <h3 style={{ marginBottom: 12 }}>
                          Daily activity
                        </h3>

                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            marginBottom: 24,
                          }}
                        >
                          {person.logs.length === 0 ? (
                            <div
                              style={{
                                opacity: 0.6,
                                padding: 18,
                                borderRadius: 14,
                                background: "rgba(255,255,255,.035)",
                              }}
                            >
                              No daily tracking activity yet.
                            </div>
                          ) : (
                            [...person.logs]
                              .sort(
                                (a: any, b: any) =>
                                  new Date(`${b.log_date}T00:00:00`).getTime() -
                                  new Date(`${a.log_date}T00:00:00`).getTime()
                              )
                              .map((log: any) => {
                                const dayFoods = person.foods.filter(
                                  (food: any) =>
                                    food.daily_log_id === log.id
                                );

                                const dayTotals = dayFoods.reduce(
                                  (acc: any, food: any) => {
                                    acc.calories += Number(food.calories || 0);
                                    acc.protein += Number(food.protein || 0);
                                    acc.carbs += Number(food.carbs || 0);
                                    acc.fat += Number(food.fat || 0);
                                    acc.fiber += Number(food.fiber || 0);
                                    acc.cost += Number(food.cost || 0);
                                    return acc;
                                  },
                                  {
                                    calories: 0,
                                    protein: 0,
                                    carbs: 0,
                                    fat: 0,
                                    fiber: 0,
                                    cost: 0,
                                  }
                                );

                                return (
                                  <div
                                    key={log.id}
                                    style={{
                                      padding: 16,
                                      borderRadius: 16,
                                      background: "rgba(255,255,255,.035)",
                                      border:
                                        "1px solid rgba(255,255,255,.07)",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 12,
                                        flexWrap: "wrap",
                                        marginBottom: 12,
                                      }}
                                    >
                                      <strong>
                                        {new Date(
                                          `${log.log_date}T00:00:00`
                                        ).toLocaleDateString("en-IN", {
                                          weekday: "long",
                                          day: "numeric",
                                          month: "long",
                                          year: "numeric",
                                        })}
                                      </strong>

                                      <span
                                        style={{
                                          padding: "6px 10px",
                                          borderRadius: 999,
                                          fontSize: 12,
                                          background: log.completed
                                            ? "rgba(34,197,94,.12)"
                                            : "rgba(255,255,255,.06)",
                                          border: log.completed
                                            ? "1px solid rgba(34,197,94,.22)"
                                            : "1px solid rgba(255,255,255,.08)",
                                        }}
                                      >
                                        {log.completed
                                          ? "✓ Day completed"
                                          : "Day not completed"}
                                      </span>
                                    </div>

                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                          "repeat(auto-fit,minmax(105px,1fr))",
                                        gap: 8,
                                      }}
                                    >
                                      <div>
                                        <small>CALORIES</small>
                                        <div>
                                          {Math.round(dayTotals.calories)}
                                        </div>
                                      </div>

                                      <div>
                                        <small>PROTEIN</small>
                                        <div>
                                          {Math.round(dayTotals.protein)}g
                                        </div>
                                      </div>

                                      <div>
                                        <small>CARBS</small>
                                        <div>
                                          {Math.round(dayTotals.carbs)}g
                                        </div>
                                      </div>

                                      <div>
                                        <small>FAT</small>
                                        <div>
                                          {Math.round(dayTotals.fat)}g
                                        </div>
                                      </div>

                                      <div>
                                        <small>FIBER</small>
                                        <div>
                                          {Math.round(dayTotals.fiber)}g
                                        </div>
                                      </div>

                                      <div>
                                        <small>SPENDING</small>
                                        <div>
                                          ₹{Math.round(dayTotals.cost)}
                                        </div>
                                      </div>

                                      <div>
                                        <small>FOODS</small>
                                        <div>{dayFoods.length}</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>

                        <h3 style={{ marginBottom: 12 }}>
                          Food history
                        </h3>

                        {foodsByDate.length === 0 ? (
                          <div
                            style={{
                              opacity: 0.6,
                              padding: 18,
                            }}
                          >
                            This user has not logged any food yet.
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "grid",
                              gap: 10,
                              maxHeight: 520,
                              overflowY: "auto",
                            }}
                          >
                            {foodsByDate.map((food: any) => (
                              <div
                                key={food.id}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "minmax(150px,1.5fr) repeat(6,minmax(70px,1fr))",
                                  gap: 10,
                                  alignItems: "center",
                                  padding: 14,
                                  borderRadius: 14,
                                  background:
                                    "rgba(255,255,255,.035)",
                                  border:
                                    "1px solid rgba(255,255,255,.06)",
                                }}
                              >
                                <div>
                                  <strong>
                                    {food.food_name}
                                  </strong>
                                  <div
                                    style={{
                                      opacity: 0.55,
                                      fontSize: 12,
                                      marginTop: 3,
                                    }}
                                  >
                                    {food.quantity} g •{" "}
                                    {new Date(
                                      food.created_at
                                    ).toLocaleString("en-IN")}
                                  </div>
                                </div>

                                <div>
                                  <small>CAL</small>
                                  <div>
                                    {Math.round(
                                      Number(food.calories || 0)
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <small>PRO</small>
                                  <div>
                                    {Math.round(
                                      Number(food.protein || 0)
                                    )}g
                                  </div>
                                </div>

                                <div>
                                  <small>CARB</small>
                                  <div>
                                    {Math.round(
                                      Number(food.carbs || 0)
                                    )}g
                                  </div>
                                </div>

                                <div>
                                  <small>FAT</small>
                                  <div>
                                    {Math.round(
                                      Number(food.fat || 0)
                                    )}g
                                  </div>
                                </div>

                                <div>
                                  <small>FIBER</small>
                                  <div>
                                    {Math.round(
                                      Number(food.fiber || 0)
                                    )}g
                                  </div>
                                </div>

                                <div>
                                  <small>COST</small>
                                  <div>
                                    ₹
                                    {Math.round(
                                      Number(food.cost || 0)
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <h3
                          style={{
                            marginTop: 24,
                            marginBottom: 12,
                          }}
                        >
                          Completed days
                        </h3>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          {person.logs
                            .filter((log: any) => log.completed)
                            .map((log: any) => (
                              <span
                                key={log.id}
                                style={{
                                  padding: "8px 11px",
                                  borderRadius: 999,
                                  background:
                                    "rgba(34,197,94,.10)",
                                  border:
                                    "1px solid rgba(34,197,94,.20)",
                                  fontSize: 12,
                                }}
                              >
                                {new Date(
                                  `${log.log_date}T00:00:00`
                                ).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            ))}

                          {person.logs.filter(
                            (log: any) => log.completed
                          ).length === 0 && (
                            <span style={{ opacity: 0.55 }}>
                              No completed days yet.
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </section>

        )}

      </main>

      {showFoodModal && (

        <div
          className="modal-backdrop"
          onMouseDown={() =>
            setShowFoodModal(false)
          }
        >

          <div
            className="food-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="eyebrow">
                  {editingFood
                    ? "EDIT ENTRY"
                    : "NEW ENTRY"}
                </span>

                <h2>
                  {editingFood
                    ? "Edit food"
                    : "Add food"}
                </h2>

                <p>
                  Enter the nutrition values
                  exactly as you know them.
                </p>

              </div>

              <button
                className="close-modal"
                onClick={() =>
                  setShowFoodModal(false)
                }
              >
                <X size={19} />
              </button>

            </div>

            <div className="form-grid">

              <div className="form-field full">

                <label>
                  Food item
                </label>

                <input
                  value={foodForm.name}
                  onChange={(event) =>
                    updateFoodForm(
                      "name",
                      event.target.value
                    )
                  }
                  placeholder="e.g. Chicken breast"
                />

              </div>

              <div className="form-field">

                <label>
                  Quantity
                </label>

                <input
                  value={foodForm.quantity}
                  onChange={(event) =>
                    updateFoodForm(
                      "quantity",
                      event.target.value
                    )
                  }
                  placeholder="e.g. 200 g"
                />

              </div>

              <div className="form-field">

                <label>
                  Cost (₹)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={foodForm.cost}
                  onChange={(event) =>
                    updateFoodForm(
                      "cost",
                      event.target.value
                    )
                  }
                  placeholder="e.g. 90"
                />

              </div>

            </div>

            <div className="nutrition-heading">

              <div>

                <h3>
                  Nutrition
                </h3>

                <span>
                  You enter the values.
                  MacroTrack only totals them.
                </span>

              </div>

            </div>

            <div className="nutrition-form-grid">

              {[
                ["calories", "Calories", "kcal"],
                ["protein", "Protein", "g"],
                ["carbs", "Carbs", "g"],
                ["fat", "Fat", "g"],
                ["fiber", "Fiber", "g"],
              ].map(
                ([field, label, unit]) => (

                  <div
                    className="form-field"
                    key={field}
                  >

                    <label>
                      {label}
                    </label>

                    <div className="input-with-unit">

                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={
                          foodForm[
                            field as keyof typeof emptyFood
                          ]
                        }
                        onChange={(event) =>
                          updateFoodForm(
                            field as keyof typeof emptyFood,
                            event.target.value
                          )
                        }
                        placeholder="0"
                      />

                      <span>
                        {unit}
                      </span>

                    </div>

                  </div>

                )
              )}

            </div>

            <div className="modal-footer">

              <button
                className="cancel-button"
                onClick={() =>
                  setShowFoodModal(false)
                }
              >
                Cancel
              </button>

              <button
                className="save-food-button"
                onClick={saveFood}
              >

                <CircleCheck size={18} />

                {editingFood
                  ? "Save changes"
                  : "Save food"}

              </button>

            </div>

          </div>

        </div>

      )}

      {showSettingsModal && (

        <div
          className="modal-backdrop"
          onMouseDown={() =>
            setShowSettingsModal(false)
          }
        >

          <div
            className="food-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="eyebrow">
                  PERSONAL GOALS
                </span>

                <h2>
                  Your daily targets
                </h2>

                <p>
                  These are targets, not limits.
                  Eat more whenever you want.
                </p>

              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={handleSignOut}
                  title="Log out of MacroTrack"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 11px",
                    minHeight: 32,
                    borderRadius: 9,
                    border: "1px solid rgba(239,68,68,.30)",
                    background: "rgba(239,68,68,.10)",
                    color: "#f87171",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <LogOut size={15} />
                  Log out
                </button>

                <button
                  className="close-modal"
                  onClick={() =>
                    setShowSettingsModal(false)
                  }
                >
                  <X size={19} />
                </button>
              </div>

            </div>

            <div className="form-grid">

              {[
                ["calories", "Daily calories", "kcal"],
                ["protein", "Protein", "g"],
                ["carbs", "Carbs", "g"],
                ["fat", "Fat", "g"],
                ["fiber", "Fiber", "g"],
                ["budget", "Daily food budget", "₹"],
              ].map(
                ([field, label, unit]) => (

                  <div
                    className="form-field"
                    key={field}
                  >

                    <label>
                      {label}
                    </label>

                    <div className="input-with-unit">

                      <input
                        type="number"
                        min="1"
                        value={
                          settingsForm[
                            field as keyof Goals
                          ]
                        }
                        onChange={(event) =>
                          updateSetting(
                            field as keyof Goals,
                            event.target.value
                          )
                        }
                      />

                      <span>
                        {unit}
                      </span>

                    </div>

                  </div>

                )
              )}

            </div>

            <div className="modal-footer">

              <button
                className="cancel-button"
                onClick={() =>
                  setShowSettingsModal(false)
                }
              >
                Cancel
              </button>

              <button
                className="save-food-button"
                onClick={saveSettings}
              >

                <CircleCheck size={18} />

                Save goals

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;