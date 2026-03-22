<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js';

  Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

  export let title = 'Spese per categoria';
  export let month: number | null = null;
  export let year: number | null = null;

  let data: Array<{id: number, name: string, amount: number, color: string, icon: string, hasChildren: number, budget?: number}> = [];
  let budgets: Map<string, number> = new Map();
  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let loading = true;

  // Drill-down state
  let parentId: number | null = null;
  let parentName: string | null = null;
  let parentIcon: string | null = null;

  // Period state (updated by dashboard events)
  let periodFrom: string | null = null;
  let periodTo: string | null = null;

  // Fetch data from API
  async function fetchData() {
    loading = true;
    try {
      let url: string;
      if (periodFrom && periodTo) {
        url = `/api/stats?from=${periodFrom}&to=${periodTo}`;
      } else {
        const m = month ?? (new Date().getMonth() + 1);
        const y = year ?? new Date().getFullYear();
        url = `/api/stats?month=${m}&year=${y}`;
      }
      if (parentId) {
        url += `&parentId=${parentId}`;
      }

      // Fetch stats and budgets in parallel
      const [statsRes, budgetsRes] = await Promise.all([
        fetch(url),
        fetch('/api/budgets')
      ]);

      const stats = await statsRes.json();
      const budgetList = await budgetsRes.json();

      // Build budgets map
      budgets = new Map(budgetList.map((b: any) => [b.category_id.toString(), b.amount]));

      data = (stats.byCategory || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        amount: c.amount,
        color: c.color || '#6B7280',
        icon: c.icon || '📦',
        hasChildren: c.hasChildren || 0,
        budget: budgets.get(c.id.toString())
      }));

      // Chart update happens via reactive $: displayData block
    } catch (error) {
      console.error('Error fetching category data:', error);
      data = [];
    } finally {
      loading = false;
    }
  }

  // Handle click on category to drill-down
  function handleCategoryClick(item: typeof data[0]) {
    if (item.hasChildren > 0 && !parentId) {
      parentId = item.id;
      parentName = item.name;
      parentIcon = item.icon;
      fetchData();
    }
  }

  // Go back to parent view
  function goBack() {
    parentId = null;
    parentName = null;
    parentIcon = null;
    fetchData();
  }

  function updateChart() {
    if (!chart) return;
    // Use displayData (with Altro grouping) for the chart
    const chartData = displayData.length > 0 ? displayData : data;
    chart.data.labels = chartData.map(d => `${d.icon} ${d.name}`);
    chart.data.datasets[0].data = chartData.map(d => d.amount);
    chart.data.datasets[0].backgroundColor = chartData.map(d => d.color);
    chart.update();
  }

  function initChart() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                return ` € ${value.toFixed(2)}`;
              }
            }
          }
        }
      }
    });
  }

  // Listen for refresh events
  function handleRefresh() {
    fetchData();
  }

  function handlePeriodChange(e: Event) {
    const detail = (e as CustomEvent).detail;
    if (detail) {
      periodFrom = detail.from || null;
      periodTo = detail.to || null;
      if (detail.month && detail.year && !detail.from) {
        month = detail.month;
        year = detail.year;
        periodFrom = null;
        periodTo = null;
      }
    }
    parentId = null;
    parentName = null;
    parentIcon = null;
    fetchData();
  }

  onMount(() => {
    initChart();
    fetchData();

    window.addEventListener('refreshStats', handleRefresh);
    window.addEventListener('transactionDeleted', handleRefresh);
    window.addEventListener('periodChanged', handlePeriodChange);

    return () => {
      window.removeEventListener('refreshStats', handleRefresh);
      window.removeEventListener('transactionDeleted', handleRefresh);
      window.removeEventListener('periodChanged', handlePeriodChange);
    };
  });

  onDestroy(() => {
    chart?.destroy();
  });

  // Group small categories into "Altro" (< 3% of total)
  const ALTRO_THRESHOLD = 0.03;
  let altroExpanded = false;
  let altroItems: typeof data = [];
  let displayData: typeof data = [];

  $: total = data.reduce((sum, d) => sum + d.amount, 0);

  $: {
    if (total > 0 && data.length > 0) {
      const big = data.filter(d => d.amount / total >= ALTRO_THRESHOLD);
      const small = data.filter(d => d.amount / total < ALTRO_THRESHOLD);
      if (small.length >= 2) {
        altroItems = small.sort((a, b) => b.amount - a.amount);
        const altroTotal = small.reduce((sum, d) => sum + d.amount, 0);
        displayData = [...big, { id: -1, name: 'Altro', amount: altroTotal, color: '#9CA3AF', icon: '\u{1F4E6}', hasChildren: 0 }];
      } else {
        altroItems = [];
        displayData = data;
      }
    } else {
      altroItems = [];
      displayData = data;
    }
    updateChart();
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
  <!-- Header con breadcrumb -->
  {#if parentId}
    <button
      onclick={goBack}
      class="text-blue-600 dark:text-blue-400 text-sm mb-2 flex items-center gap-1 hover:underline"
    >
      &#8592; Tutte le categorie
    </button>
    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-4">{parentIcon} {parentName}</h3>
  {:else}
    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
  {/if}

  {#if loading}
    <div class="h-48 flex items-center justify-center">
      <div class="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
    </div>
  {:else if data.length === 0}
    <div class="h-48 flex items-center justify-center text-gray-400">
      <div class="text-center">
        <div class="text-3xl mb-2">📊</div>
        <p class="text-sm">Nessun dato</p>
      </div>
    </div>
  {:else}
    <div class="relative h-48 mb-4">
      <canvas bind:this={canvas}></canvas>
      <!-- Totale al centro -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">&#8364; {total.toFixed(0)}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">totale</div>
        </div>
      </div>
    </div>

    <!-- Legenda -->
    <div class="space-y-2 max-h-40 overflow-y-auto">
      {#each displayData.sort((a, b) => b.amount - a.amount) as item}
        {@const overBudget = item.budget && item.amount > item.budget}
        {@const isAltro = item.id === -1}
        <div>
          <button
            onclick={() => isAltro ? (altroExpanded = !altroExpanded) : handleCategoryClick(item)}
            class="w-full flex items-center justify-between text-sm py-1 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors {item.hasChildren > 0 && !parentId || isAltro ? 'cursor-pointer' : 'cursor-default'}"
          >
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full" style="background-color: {item.color}"></div>
              <span>{item.icon} {item.name}</span>
              {#if isAltro}
                <span class="text-gray-400 text-xs">{altroExpanded ? '⌄' : '›'}</span>
              {:else if item.hasChildren > 0 && !parentId}
                <span class="text-gray-400 text-xs">›</span>
              {/if}
            </div>
            <div class="text-right">
              <span class="font-medium {overBudget ? 'text-red-600' : ''}">€ {item.amount.toFixed(2)}</span>
              {#if item.budget}
                <span class="text-xs text-gray-400 ml-1">/ €{item.budget.toFixed(0)}</span>
                {#if overBudget}
                  <span class="text-xs text-red-500 ml-1">!</span>
                {/if}
              {/if}
            </div>
          </button>
          {#if isAltro && altroExpanded}
            <div class="pl-5 space-y-1 mt-1">
              {#each altroItems as sub}
                <div class="flex items-center justify-between text-xs py-0.5 px-1 text-gray-600 dark:text-gray-400">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full" style="background-color: {sub.color}"></div>
                    <span>{sub.icon} {sub.name}</span>
                  </div>
                  <span class="font-medium">€ {sub.amount.toFixed(2)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
