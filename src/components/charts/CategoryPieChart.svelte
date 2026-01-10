<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js';

  Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

  export let title = 'Spese per categoria';
  export let month: number | null = null;
  export let year: number | null = null;

  let data: Array<{name: string, amount: number, color: string, icon: string}> = [];
  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let loading = true;

  // Fetch data from API
  async function fetchData() {
    loading = true;
    try {
      const m = month ?? (new Date().getMonth() + 1);
      const y = year ?? new Date().getFullYear();
      const res = await fetch(`/api/stats?month=${m}&year=${y}`);
      const stats = await res.json();

      data = (stats.byCategory || []).map((c: any) => ({
        name: c.name,
        amount: c.amount,
        color: c.color || '#6B7280',
        icon: c.icon || '📦'
      }));

      updateChart();
    } catch (error) {
      console.error('Error fetching category data:', error);
      data = [];
    } finally {
      loading = false;
    }
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
  <h3 class="font-semibold text-gray-900 mb-4">{title}</h3>

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
        <div class="flex items-center justify-between text-sm">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background-color: {item.color}"></div>
            <span>{item.icon} {item.name}</span>
          </div>
          <span class="font-medium">€ {item.amount.toFixed(2)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
