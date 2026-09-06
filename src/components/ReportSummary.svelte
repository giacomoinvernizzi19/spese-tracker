<script lang="ts">
  import {reportSummary} from '../lib/report-summary';
  const currency=(value:number|undefined)=>value===undefined?'—':value.toLocaleString('it-IT',{style:'currency',currency:'EUR'});
</script>
<div id="section-summary" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" aria-label="Riepilogo report">
  <div class="bg-white dark:bg-gray-800 rounded-xl p-4"><p class="text-gray-500 text-sm">Totale spese</p><p id="totalExpenses" class="text-2xl font-bold text-red-600">{currency($reportSummary?.expenses)}</p></div>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-4"><p class="text-gray-500 text-sm">Totale entrate</p><p id="totalIncome" class="text-2xl font-bold text-green-600">{currency($reportSummary?.income)}</p></div>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-4"><p class="text-gray-500 text-sm">Media mensile con movimenti</p><p id="monthlyAvg" class="text-2xl font-bold">{currency($reportSummary?.monthlyAverage)}</p></div>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-4"><p class="text-gray-500 text-sm">vs anno precedente</p><p id="yearDiff" class="text-2xl font-bold" class:text-red-600={($reportSummary?.difference??0)>0} class:text-green-600={($reportSummary?.difference??0)<0}>{$reportSummary?.difference==null?'—':`${$reportSummary.difference>0?'+':''}${$reportSummary.difference.toFixed(1)}%`}</p></div>
</div>
