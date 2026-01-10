<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, BarController } from 'chart.js';

  Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, BarController);

  export let title = 'Ultimi 6 mesi';

  let data: Array<{month: string, amount: number}> = [];
  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let loading = true;

  // Fetch data from API
  async function fetchData() {
    loading = true;
    try {
      const now = new Date();
      const res = await fetch(`/api/stats?month=${now.getMonth() + 1}&year=${now.getFullYear()}`);
      const stats = await res.json();

      data = stats.monthlyTrend || [];
      updateChart();
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      data = [];
    } finally {
      loading = false;
    }
  }

  function updateChart() {
    if (!chart) return;
    chart.data.labels = data.map(d => d.month);
    chart.data.datasets[0].data = data.map(d => d.amount);
    chart.update();
  }

  function initChart() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: '#3B82F6',
          borderRadius: 4,
          barThickness: 24
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => ` € ${context.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `€${value}`
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
    <div class="h-48">
      <canvas bind:this={canvas}></canvas>
    </div>
  {/if}
</div>
