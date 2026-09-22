import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// 1. Initialize Supabase Client
const SUPABASE_URL = 'https://jekevrqvmqttzcjmmlma.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WjpVAaYL62uw2qEtT7zA2Q_w8hxL-DA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Track Chart.js instance to prevent "Canvas is already in use" errors on refresh
let expenseChartInstance = null;

// Color palette for the categories
const CATEGORY_COLORS = ['#C99A3E', '#EF4444', '#0D9488', '#3B82F6', '#8B5CF6', '#F59E0B'];

/**
 * Main function to load all dashboard data from Supabase
 */
async function loadDashboard() {
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*');

  if (error) {
    console.error('Error fetching transactions:', error);
    return;
  }

  // --- A. CALCULATE SUMMARY CARDS ---
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals = {};

  transactions.forEach(entry => {
    const amount = Number(entry.amount) || 0;

    if (entry.type === 'income') {
      totalIncome += amount;
    } else if (entry.type === 'expense') {
      totalExpenses += amount;

      // Group expense by category
      const cat = entry.category || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
    }
  });

  const totalBalance = totalIncome - totalExpenses;

  // Render Summary Cards in DOM
  document.getElementById('total-income').innerText = formatCurrency(totalIncome);
  document.getElementById('total-expenses').innerText = formatCurrency(totalExpenses);
  document.getElementById('total-balance').innerText = formatCurrency(totalBalance);

  // --- B. RENDER CATEGORY CHART & LIST ---
  const categories = Object.keys(categoryTotals);
  const amounts = Object.values(categoryTotals);

  renderCategoryChart(categories, amounts);
  renderCategoryList(categoryTotals, totalExpenses);
}

/**
 * Render/Update Chart.js Doughnut Chart
 */
function renderCategoryChart(categories, amounts) {
  const canvas = document.getElementById('expenseChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // If a chart already exists, destroy it before rendering new data
  if (expenseChartInstance) {
    expenseChartInstance.destroy();
  }

  expenseChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.length > 0 ? categories : ['No Expenses'],
      datasets: [{
        data: amounts.length > 0 ? amounts : [1],
        backgroundColor: categories.length > 0 ? CATEGORY_COLORS : ['#E2E8F0'],
        borderWidth: 0,
        cutout: '75%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: categories.length > 0,
          callbacks: {
            label: (ctx) => ` ₱${ctx.parsed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          }
        }
      }
    }
  });
}

/**
 * Render Category List Items Dynamically
 */
function renderCategoryList(categoryTotals, totalExpenses) {
  const listContainer = document.querySelector('ul.space-y-3');
  if (!listContainer) return;

  listContainer.innerHTML = ''; // Clear hardcoded items

  const entries = Object.entries(categoryTotals);

  if (entries.length === 0) {
    listContainer.innerHTML = `<li class="text-xs text-slate-400 text-center py-2">No expenses recorded yet</li>`;
    return;
  }

  entries.forEach(([category, amount], index) => {
    const percentage = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
    const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

    const li = document.createElement('li');
    li.className = 'flex items-center justify-between';
    li.innerHTML = `
      <span class="flex items-center gap-2 text-slate-600">
        <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${color}"></span> 
        ${category}
      </span>
      <span class="num text-slate-900">
        ${formatCurrency(amount)} 
        <span class="text-slate-400">${percentage}%</span>
      </span>
    `;
    listContainer.appendChild(li);
  });

  // Update center overlay total text
  const totalOverlay = document.querySelector('.mt-5.relative span.num');
  if (totalOverlay) {
    totalOverlay.innerText = formatCurrency(totalExpenses);
  }
}

/**
 * Currency Formatting Helper
 */
function formatCurrency(amount) {
  return '₱' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Enable Supabase Realtime Listener (Deliverable 5)
 */
function subscribeToRealtime() {
  supabase
    .channel('transactions-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      () => {
        loadDashboard(); // Auto-reload figures on insert/update/delete
      }
    )
    .subscribe();
}

// Initial Run
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  subscribeToRealtime();
});