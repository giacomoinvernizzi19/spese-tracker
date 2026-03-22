<script lang="ts">
  import { onMount } from 'svelte';

  // Props
  export let categories: Array<{id: number, name: string, icon: string, color: string}> = [];
  export let onSave: (data: {amount: number, category_id: number, description: string, date: string}) => void = () => {};
  export let onClose: () => void = () => {};

  // State
  let amount = '';
  let selectedCategory: number | null = null;
  let description = '';
  let date = new Date().toISOString().split('T')[0];
  let isSubmitting = false;

  // Tastierino
  function appendDigit(digit: string) {
    if (digit === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    amount += digit;
  }

  function deleteDigit() {
    amount = amount.slice(0, -1);
  }

  function clearAmount() {
    amount = '';
  }

  // Formatta importo per display
  $: displayAmount = amount ? `€ ${amount}` : '€ 0.00';

  // Submit
  async function handleSubmit() {
    if (!amount || !selectedCategory) return;

    isSubmitting = true;
    try {
      await onSave({
        amount: parseFloat(amount),
        category_id: selectedCategory,
        description: description.trim(),
        date
      });
      // Reset
      amount = '';
      selectedCategory = null;
      description = '';
      onClose();
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
    } finally {
      isSubmitting = false;
    }
  }

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (e.key >= '0' && e.key <= '9') appendDigit(e.key);
    if (e.key === '.') appendDigit('.');
    if (e.key === 'Backspace') deleteDigit();
    if (e.key === 'Enter' && amount && selectedCategory) handleSubmit();
    if (e.key === 'Escape') onClose();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" on:click|self={onClose}>
  <div class="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold dark:text-gray-100">Nuova Spesa</h2>
      <button on:click={onClose} class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl">&times;</button>
    </div>

    <!-- Amount Display -->
    <div class="text-center mb-6">
      <div class="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">{displayAmount}</div>
      <input
        type="date"
        bind:value={date}
        class="text-sm text-gray-500 dark:text-gray-400 bg-transparent border-none text-center dark:text-gray-100"
      />
    </div>

    <!-- Keypad -->
    <div class="grid grid-cols-4 gap-2 mb-6">
      {#each ['7', '8', '9', 'C'] as key}
        <button
          on:click={() => key === 'C' ? clearAmount() : appendDigit(key)}
          class="h-12 rounded-lg text-xl font-medium {key === 'C' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'} hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {key}
        </button>
      {/each}
      {#each ['4', '5', '6', '\u2190'] as key}
        <button
          on:click={() => key === '\u2190' ? deleteDigit() : appendDigit(key)}
          class="h-12 rounded-lg text-xl font-medium {key === '\u2190' ? 'bg-gray-200 dark:bg-gray-600' : 'bg-gray-100 dark:bg-gray-700'} text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {key}
        </button>
      {/each}
      {#each ['1', '2', '3', '.'] as key}
        <button
          on:click={() => appendDigit(key)}
          class="h-12 rounded-lg text-xl font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {key}
        </button>
      {/each}
      <button
        on:click={() => appendDigit('0')}
        class="col-span-2 h-12 rounded-lg text-xl font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        0
      </button>
      <button
        on:click={() => appendDigit('00')}
        class="h-12 rounded-lg text-xl font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        00
      </button>
      <div></div>
    </div>

    <!-- Categories -->
    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categoria</label>
      <div class="grid grid-cols-4 gap-2">
        {#each categories as category}
          <button
            on:click={() => selectedCategory = category.id}
            class="flex flex-col items-center p-2 rounded-lg border-2 transition-all {
              selectedCategory === category.id
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }"
          >
            <span class="text-2xl">{category.icon}</span>
            <span class="text-xs text-gray-600 dark:text-gray-400 truncate w-full text-center">{category.name}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Description -->
    <div class="mb-6">
      <input
        type="text"
        bind:value={description}
        placeholder="Note (opzionale)"
        class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      />
    </div>

    <!-- Submit Button -->
    <button
      on:click={handleSubmit}
      disabled={!amount || !selectedCategory || isSubmitting}
      class="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
    >
      {isSubmitting ? 'Salvataggio...' : 'Salva Spesa'}
    </button>
  </div>
</div>
