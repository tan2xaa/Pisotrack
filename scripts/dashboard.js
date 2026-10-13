import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://jekevrqvmqttzcjmmlma.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WjpVAaYL62uw2qEtT7zA2Q_w8hxL-DA";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let expenseChartInstance = null;

const CATEGORY_COLORS = [
  "#C99A3E",
  "#EF4444",
  "#0D9488",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
];

const MONTHLY_BUDGET = 20000;
const MAX_AMOUNT = 999999999.99;

let categoriesCache = [];
let canCreateCategory = false;
let currentUser = null;

// -------------------- AUTHENTICATION & ROLES --------------------

async function applyRoleRestrictions() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    window.location.href = "login.html";
    return null;
  }

  currentUser = user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching role:", profileError);
    return null;
  }

  if (profile.role === "admin") {
    document.querySelectorAll("[data-owner-only]").forEach((el) => {
      el.classList.remove("hidden");
    });
  }

  return profile.role;
}

// -------------------- DASHBOARD --------------------

async function loadDashboard() {
  const now = new Date();

  // Current month in local time, converted to ISO timestamps.
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();

  const nextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
  ).toISOString();

  let query = supabase
    .from("transactions")
    .select("*")
    .gte("created_at", monthStart)
    .lt("created_at", nextMonth);

  // Staff should only see their own transactions.
  // Admins can see all transactions allowed by database policies.
  if (currentUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (profile?.role !== "admin") {
      query = query.eq("user_id", currentUser.id);
    }
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error("Error fetching transactions:", error);
    return;
  }

  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals = {};

  transactions.forEach((entry) => {
    const amount = Number(entry.amount) || 0;

    if (entry.type === "income") {
      totalIncome += amount;
    } else if (entry.type === "expense") {
      totalExpenses += amount;

      const category = entry.category || "Uncategorized";

      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    }
  });

  const balanceElement = document.getElementById("total-balance");

  if (balanceElement) {
    balanceElement.innerText = formatCurrency(totalIncome - totalExpenses);
  }

  document.getElementById("total-income").innerText =
    formatCurrency(totalIncome);

  document.getElementById("total-expenses").innerText =
    formatCurrency(totalExpenses);

  renderCategoryChart(
    Object.keys(categoryTotals),
    Object.values(categoryTotals),
  );

  renderCategoryList(categoryTotals, totalExpenses);
}

// -------------------- EXPENSE CHART --------------------

function renderCategoryChart(categories, amounts) {
  const canvas = document.getElementById("expenseChart");
  if (!canvas) return;

  if (expenseChartInstance) {
    expenseChartInstance.destroy();
  }

  expenseChartInstance = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: categories.length ? categories : ["No Expenses"],
      datasets: [
        {
          data: amounts.length ? amounts : [1],
          backgroundColor: categories.length
            ? categories.map(
                (_, index) => CATEGORY_COLORS[index % CATEGORY_COLORS.length],
              )
            : ["#E2E8F0"],
          borderWidth: 0,
          cutout: "75%",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: categories.length > 0,
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

function renderCategoryList(categoryTotals, totalExpenses) {
  const listContainer = document.querySelector("ul.space-y-3");
  if (!listContainer) return;

  listContainer.innerHTML = "";

  const entries = Object.entries(categoryTotals);

  if (entries.length === 0) {
    listContainer.innerHTML =
      '<li class="text-xs text-slate-400 text-center py-2">No expenses recorded this month</li>';
  } else {
    entries.forEach(([category, amount], index) => {
      const percentage =
        totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;

      const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

      const li = document.createElement("li");
      li.className = "flex items-center justify-between";

      li.innerHTML = `
        <span class="flex items-center gap-2 text-slate-600">
          <span class="w-2 h-2 rounded-full inline-block"
            style="background-color: ${color}"></span>
          ${escapeHtml(category)}
        </span>
        <span class="num text-slate-900">
          ${formatCurrency(amount)}
          <span class="text-slate-400">${percentage}%</span>
        </span>
      `;

      listContainer.appendChild(li);
    });
  }

  const totalOverlay = document.querySelector(".mt-5.relative span.num");

  if (totalOverlay) {
    totalOverlay.innerText = formatCurrency(totalExpenses);
  }
}

// -------------------- HELPERS --------------------

function formatCurrency(amount) {
  return (
    "₱" +
    Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validateAmount(raw) {
  const value = String(raw).trim();

  if (value === "") {
    return "Enter an amount (numbers only).";
  }

  if (value.startsWith("-")) {
    return "Amount can't be negative.";
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return "Use numbers only, with up to 2 decimal places.";
  }

  const amount = Number(value);

  if (amount <= 0) {
    return "Amount must be greater than 0.";
  }

  if (amount > MAX_AMOUNT) {
    return "Amount is too large.";
  }

  return null;
}

// -------------------- MONTHLY BUDGET CHECK --------------------

async function checkMonthlyBudget(newAmount) {
  const now = new Date();

  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();

  const nextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
  ).toISOString();

  let query = supabase
    .from("transactions")
    .select("amount")
    .eq("type", "expense")
    .gte("created_at", monthStart)
    .lt("created_at", nextMonth);

  // Check only this staff member's expenses.
  // Admin budget checks use all transactions visible under database policies.
  if (currentUser) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (profileError) {
      console.error("Role check failed:", profileError);
      return "Could not verify your role.";
    }

    if (profile?.role !== "admin") {
      query = query.eq("user_id", currentUser.id);
    }
  }

  const { data: expenses, error } = await query;

  if (error) {
    console.error("Budget check error:", error);
    return "Could not check monthly expenses: " + error.message;
  }

  const totalExpenses = (expenses || []).reduce(
    (total, entry) => total + Number(entry.amount || 0),
    0,
  );

  console.log("Monthly budget:", MONTHLY_BUDGET);
  console.log("Existing expenses:", totalExpenses);
  console.log("New expense:", newAmount);

  if (totalExpenses + newAmount > MONTHLY_BUDGET) {
    const remaining = MONTHLY_BUDGET - totalExpenses;

    return `Monthly budget exceeded! Remaining budget: ${formatCurrency(
      Math.max(0, remaining),
    )}`;
  }

  return null;
}

// -------------------- CATEGORIES --------------------

async function loadCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .order("name");

  if (error) {
    console.error("Error fetching categories:", error);
    return;
  }

  categoriesCache = (data || []).map((category) => category.name);

  const select = document.getElementById("entry-category");
  select.innerHTML = "";

  select.add(new Option("Select category", ""));

  categoriesCache.forEach((name) => {
    select.add(new Option(name, name));
  });

  if (canCreateCategory) {
    select.add(new Option("+ New category...", "__new__"));
  }
}

// -------------------- ENTRY FORM --------------------

function setupEntryForm(role) {
  canCreateCategory = role === "admin";

  const modal = document.getElementById("entry-modal");
  const form = document.getElementById("entry-form");
  const openBtn = document.getElementById("add-entry-btn");
  const dateInput = document.getElementById("entry-date");
  const categorySelect = document.getElementById("entry-category");
  const newCategoryRow = document.getElementById("new-category-row");
  const newCategoryInput = document.getElementById("new-category-input");
  const addCategoryBtn = document.getElementById("add-category-btn");
  const categoryError = document.getElementById("category-error");
  const amountInput = document.getElementById("entry-amount");
  const typeInput = document.getElementById("entry-type");
  const descInput = document.getElementById("entry-description");
  const entryError = document.getElementById("entry-error");
  const submitBtn = document.getElementById("entry-submit");

  function showCategoryError(message) {
    categoryError.textContent = message;
    categoryError.classList.toggle("hidden", !message);
  }

  function showEntryError(message) {
    entryError.textContent = message;
    entryError.classList.toggle("hidden", !message);
    amountInput.classList.toggle(
      "border-red-500",
      message.toLowerCase().includes("amount"),
    );
  }

  function toggleNewCategoryRow(show) {
    newCategoryRow.classList.toggle("hidden", !show);
    newCategoryRow.classList.toggle("flex", show);
  }

  async function openModal() {
    form.reset();
    showCategoryError("");
    showEntryError("");
    amountInput.classList.remove("border-red-500");
    toggleNewCategoryRow(false);

    const now = new Date();
    dateInput.value = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    await loadCategories();
  }

  function closeModal() {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  async function addCategory() {
    if (!canCreateCategory) return;

    showCategoryError("");

    const name = newCategoryInput.value.trim();

    if (!name) {
      return showCategoryError("Type a name for the new category.");
    }

    if (name.length > 40) {
      return showCategoryError("Max 40 characters.");
    }

    let match = categoriesCache.find(
      (category) => category.toLowerCase() === name.toLowerCase(),
    );

    if (!match) {
      addCategoryBtn.disabled = true;

      const { error } = await supabase.from("categories").insert({ name });

      addCategoryBtn.disabled = false;

      if (error && error.code !== "23505") {
        return showCategoryError("Could not add category: " + error.message);
      }

      await loadCategories();

      match = categoriesCache.find(
        (category) => category.toLowerCase() === name.toLowerCase(),
      );
    }

    categorySelect.value = match || "";
    newCategoryInput.value = "";
    toggleNewCategoryRow(false);
  }

  openBtn.addEventListener("click", openModal);

  document.getElementById("entry-close").addEventListener("click", closeModal);

  document.getElementById("entry-cancel").addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  categorySelect.addEventListener("change", () => {
    const isNew = categorySelect.value === "__new__";

    showCategoryError("");
    toggleNewCategoryRow(isNew);

    if (isNew) newCategoryInput.focus();
  });

  addCategoryBtn.addEventListener("click", addCategory);

  newCategoryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCategory();
    }
  });

  amountInput.addEventListener("keydown", (event) => {
    if (["-", "+", "e", "E"].includes(event.key)) {
      event.preventDefault();
    }
  });

  amountInput.addEventListener("input", () => {
    showEntryError("");
    amountInput.classList.remove("border-red-500");
  });

  // Validate, check budget, then save.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showEntryError("");

    const amountError = validateAmount(amountInput.value);

    if (amountError) {
      return showEntryError(amountError);
    }

    if (!dateInput.value) {
      return showEntryError("Please pick a date.");
    }

    if (!categorySelect.value || categorySelect.value === "__new__") {
      return showEntryError("Please choose a category.");
    }

    submitBtn.disabled = true;

    try {
      if (typeInput.value === "expense") {
        const budgetError = await checkMonthlyBudget(Number(amountInput.value));

        if (budgetError) {
          return showEntryError(budgetError);
        }
      }

      // Your current table has created_at, not entry_date.
      // The database should generate created_at automatically.
      const { error } = await supabase.from("transactions").insert({
        type: typeInput.value,
        amount: Number(amountInput.value),
        category: categorySelect.value,
        description: descInput.value.trim() || null,
        user_id: currentUser.id,
      });

      if (error) {
        console.error("Save transaction error:", error);

        return showEntryError(
          error.code === "23514"
            ? "Amount must be greater than 0."
            : "Could not save entry: " + error.message,
        );
      }

      closeModal();
      await loadDashboard();
    } catch (error) {
      console.error("Unexpected submission error:", error);
      showEntryError("Something went wrong. Please try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// -------------------- REALTIME --------------------

function subscribeToRealtime() {
  supabase
    .channel("transactions-db-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "transactions",
      },
      () => {
        loadDashboard();
      },
    )
    .subscribe();
}

// -------------------- INITIALIZATION --------------------

document.addEventListener("DOMContentLoaded", async () => {
  const role = await applyRoleRestrictions();

  if (!role) return;

  setupEntryForm(role);
  await loadDashboard();
  subscribeToRealtime();
});
