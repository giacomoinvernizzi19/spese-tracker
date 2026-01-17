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

  // Fetch data from API
  async function fetchData() {
    loading = true;
    try {
      const m = month ?? (new Date().getMonth() + 1);
      const y = year ?? new Date().getFullYear();
      let url = `/api/stats?month=${m}&year=${y}`;
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

      updateChart();
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
    chart.data.labels = data.map(d => `${d.icon} ${d.name}`);
    chart.data.datasets[0].data = data.map(d => d.amount);
    chart.data.datasets[0].backgroundColor = data.map(d => d.color);
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

  onMount(() => {
    initChart();
    fetchData();

    window.addEventListener('refreshStats', handleRefresh);
    window.addEventListener('transactionDeleted', handleRefresh);

    return () => {
      window.removeEventListener('refreshStats', handleRefresh);
      window.removeEventListener('transactionDeleted', handleRefresh);
    };
  });

  onDestroy(() => {
    chart?.destroy();
  });

  // Calcola totale
  $: total = data.reduce((sum, d) => sum + d.amount, 0);
</script>

<div class="bg-white rounded-xl p-4 shadow-sm">
  <!-- Header con breadcrumb -->
  {#if parentId}
    <button
      onclick={goBack}
      class="text-blue-600 text-sm mb-2 flex items-center gap-1 hover:underline"
    >
      ← Tutte le categorie
    </button>
    <h3 class="font-semibold text-gray-900 mb-4">{parentIcon} {parentName}</h3>
  {:else}
    <h3 class="font-semibold text-gray-900 mb-4">{title}</h3>
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
          <div class="text-2xl font-bold text-gray-900">€ {total.toFixed(0)}</div>
          <div class="text-xs text-gray-500">totale</div>
        </div>
      </div>
    </div>

    <!-- Legenda -->
    <div class="space-y-2 max-h-40 overflow-y-auto">
      {#each data.sort((a, b) => b.amount - a.amount) as item}
        {@const overBudget = item.budget && item.amount > item.budget}
        <button
          onclick={() => handleCategoryClick(item)}
          class="w-full flex items-center justify-between text-sm py-1 px-1 rounded hover:bg-gray-50 transition-colors {item.hasChildren > 0 && !parentId ? 'cursor-pointer' : 'cursor-default'}"
        >
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background-color: {item.color}"></div>
            <span>{item.icon} {item.name}</span>
            {#if item.hasChildren > 0 && !parentId}
              <span class="text-gray-400 text-xs">›</span>
            {/if}
          </div>
          <div class="text-right">
            <span class="font-medium {overBudget ? 'text-red-600' : ''}">€ {item.amount.toFixed(2)}</span>
            {#if item.budget}
              <span class="text-xs text-gray-400 ml-1">/ €{item.budget.toFixed(0)}</span>
              {#if overBudget}
                <span class="text-xs text-red-500 ml-1">⚠️</span>
              {/if}
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
