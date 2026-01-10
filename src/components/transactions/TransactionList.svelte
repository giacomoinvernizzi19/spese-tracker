<script lang="ts">
  import { onMount } from 'svelte';

  // Props
  export let apiUrl = '/api/transactions?limit=100';
  export let showEmpty = true;

  // State
  let transactions: Array<{
    id: number;
    amount: number;
    description: string;
    date: string;
    category_name: string;
    category_icon: string;
    category_color: string;
  }> = [];
  let loading = true;

  // Raggruppa per data
  $: groupedTransactions = transactions.reduce((groups, t) => {
    const date = t.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(t);
    return groups;
  }, {} as Record<string, typeof transactions>);

  // Formatta data
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Oggi';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Ieri';

    return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // Fetch transactions
  async function fetchTransactions(url?: string) {
    loading = true;
    try {
      const res = await fetch(url || apiUrl);
      transactions = await res.json();
    } catch (error) {
      console.error('Error fetching transactions:', error);
      transactions = [];
    } finally {
      loading = false;
    }
  }

  // Handle delete
  async function handleDelete(id: number) {
    if (!confirm('Eliminare questa spesa?')) return;

    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      transactions = transactions.filter(t => t.id !== id);
      // Dispatch event for parent to update totals
      window.dispatchEvent(new CustomEvent('transactionDeleted', { detail: id }));
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  }

  // Listen for external updates
  function handleUpdateList(e: CustomEvent) {
    if (e.detail?.url) {
      fetchTransactions(e.detail.url);
    } else if (Array.isArray(e.detail)) {
      transactions = e.detail;
      loading = false;
    }
  }

  // Listen for refresh requests
  function handleRefresh() {
    fetchTransactions();
  }

  onMount(() => {
    fetchTransactions();

    window.addEventListener('updateTransactionList', handleUpdateList as EventListener);
    window.addEventListener('refreshTransactions', handleRefresh);

    return () => {
      window.removeEventListener('updateTransactionList', handleUpdateList as EventListener);
      window.removeEventListener('refreshTransactions', handleRefresh);
    };
  });

  // Swipe to delete
  let swipeStartX = 0;
  let swipeId: number | null = null;
  let swipeOffset = 0;

  function handleTouchStart(e: TouchEvent, id: number) {
    swipeStartX = e.touches[0].clientX;
    swipeId = id;
    swipeOffset = 0;
  }

  function handleTouchMove(e: TouchEvent) {
    if (swipeId === null) return;
    const diff = swipeStartX - e.touches[0].clientX;
    swipeOffset = Math.max(0, Math.min(80, diff));
  }

  function handleTouchEnd() {
    if (swipeOffset > 60 && swipeId !== null) {
      handleDelete(swipeId);
    }
    swipeId = null;
    swipeOffset = 0;
  }
</script>

<div class="space-y-6">
  {#if loading}
    <div class="text-center py-8 text-gray-500">
      <div class="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
      <p>Caricamento...</p>
    </div>
  {:else}
    {#each Object.entries(groupedTransactions).sort((a, b) => b[0].localeCompare(a[0])) as [date, dayTransactions]}
      <div>
        <h3 class="text-sm font-medium text-gray-500 mb-2 capitalize">{formatDate(date)}</h3>
        <div class="bg-white rounded-xl shadow-sm overflow-hidden">
          {#each dayTransactions as transaction, i (transaction.id)}
            <div
              class="relative overflow-hidden"
              on:touchstart={(e) => handleTouchStart(e, transaction.id)}
              on:touchmove={handleTouchMove}
              on:touchend={handleTouchEnd}
            >
              <!-- Delete background -->
              <div class="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
                <span class="text-white text-xl">🗑️</span>
              </div>

              <!-- Transaction item -->
              <div
                class="flex items-center gap-3 p-4 bg-white transition-transform {i < dayTransactions.length - 1 ? 'border-b border-gray-100' : ''}"
                style="transform: translateX({swipeId === transaction.id ? -swipeOffset : 0}px)"
              >
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style="background-color: {transaction.category_color}20"
                >
                  {transaction.category_icon || '📦'}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-gray-900">{transaction.category_name || 'N/A'}</div>
                  {#if transaction.description}
                    <div class="text-sm text-gray-500 truncate">{transaction.description}</div>
                  {/if}
                </div>
                <div class="text-right">
                  <div class="font-semibold text-gray-900">-€ {transaction.amount.toFixed(2)}</div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}

    {#if showEmpty && transactions.length === 0}
      <div class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-2">📭</div>
        <p>Nessuna spesa registrata</p>
        <p class="text-sm">Premi + per aggiungerne una</p>
      </div>
    {/if}
  {/if}
</div>
