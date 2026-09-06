<script lang="ts">
  import {onMount} from 'svelte';
  import {requestJson} from '../lib/client';
  type Item={id:number;amount:number;description:string;category_name:string|null;frequency:'monthly'|'weekly'|'yearly';active:number};
  let items:Item[]=[];let categories:{id:number;name:string}[]=[];
  let busy=false,loading=true,error='',notice='';let dialog:HTMLDialogElement;
  let amount:number|undefined,description='',category='',frequency='monthly',day=1,start=new Date().toISOString().slice(0,10),end='';
  const labels={monthly:'Mensile',weekly:'Settimanale',yearly:'Annuale'};
  async function load(){try{[items,categories]=await Promise.all([requestJson<Item[]>('/api/recurring'),requestJson<{id:number;name:string}[]>('/api/categories')]);}catch(e){error=e instanceof Error?e.message:'Caricamento non riuscito';}finally{loading=false;}}
  async function remove(item:Item){
    if(busy||!confirm('Eliminare questa ricorrenza? Le spese già generate restano salvate.'))return;
    busy=true;error='';
    try{await requestJson('/api/recurring',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id})});await load();}
    catch(e){error=e instanceof Error?e.message:'Eliminazione non riuscita';}finally{busy=false;}
  }
  async function save(event:SubmitEvent){
    event.preventDefault();if(busy)return;busy=true;error='';notice='';
    try{
      const result=await requestJson<{generation_error?:string}>('/api/recurring',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,type:'expense',description,category_id:category?Number(category):null,frequency,day_of_month:day,start_date:start,end_date:end||null})});
      notice=result.generation_error ?? 'Ricorrenza salvata';dialog.close();await load();
    }catch(e){error=e instanceof Error?e.message:'Salvataggio non riuscito';}finally{busy=false;}
  }
  function openForm(){error='';amount=undefined;description='';category='';frequency='monthly';day=1;start=new Date().toISOString().slice(0,10);end='';dialog.showModal();}
  onMount(load);
</script>
<section class="bg-white dark:bg-gray-800 rounded-xl p-4" aria-label="Spese ricorrenti">
  <h2 class="font-semibold text-lg">Spese ricorrenti</h2>
  {#if loading}<p role="status">Caricamento…</p>{/if}
  {#if error}<p role="alert" class="text-red-600">{error}</p>{/if}
  {#if notice}<p role="status" class="text-sm">{notice}</p>{/if}
  {#each items as item(item.id)}<div class="flex justify-between items-center border-t py-3 gap-3"><div><p>{item.description||item.category_name||'Ricorrente'}</p><p class="text-sm">{labels[item.frequency]} · {item.amount.toFixed(2)} EUR · {item.active?'Attiva':'Disattivata'}</p></div><button class="text-red-600" disabled={busy} onclick={()=>remove(item)}>Elimina</button></div>{/each}
  {#if !loading&&!items.length&&!error}<p class="text-sm my-3">Nessuna spesa ricorrente</p>{/if}
  <button id="addRecurringBtn" class="border rounded-lg p-2 w-full mt-3" disabled={busy||loading} onclick={openForm}>Aggiungi spesa ricorrente</button>
</section>
<dialog bind:this={dialog} class="rounded-xl p-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full max-w-md m-auto backdrop:bg-black/50" oncancel={event=>{if(busy)event.preventDefault();}}>
  <form onsubmit={save} class="space-y-3">
    <h2 class="font-semibold">Nuova spesa ricorrente</h2>
    {#if error}<p role="alert" class="text-red-600">{error}</p>{/if}
    <label class="block">Importo EUR<input id="recAmount" type="number" min="0.01" step="0.01" required bind:value={amount} class="block w-full border rounded p-2 bg-white dark:bg-gray-700" /></label>
    <label class="block">Descrizione<input id="recDesc" bind:value={description} class="block w-full border rounded p-2 bg-white dark:bg-gray-700" /></label>
    <label class="block">Categoria<select id="recCategory" bind:value={category} class="block w-full border rounded p-2 bg-white dark:bg-gray-700"><option value="">Nessuna</option>{#each categories as cat}<option value={String(cat.id)}>{cat.name}</option>{/each}</select></label>
    <label class="block">Frequenza<select id="recFreq" bind:value={frequency} onchange={()=>day=1} class="block w-full border rounded p-2 bg-white dark:bg-gray-700"><option value="monthly">Mensile</option><option value="weekly">Settimanale</option><option value="yearly">Annuale</option></select></label>
    {#if frequency==='weekly'}<label class="block">Giorno<select id="recDay" bind:value={day} class="block w-full border rounded p-2 bg-white dark:bg-gray-700">{#each ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'] as name,i}<option value={i}>{name}</option>{/each}</select></label>
    {:else if frequency==='monthly'}<label class="block">Giorno del mese<input id="recDay" type="number" min="1" max="31" required bind:value={day} class="block w-full border rounded p-2 bg-white dark:bg-gray-700" /></label>{/if}
    <label class="block">Data inizio<input id="recStart" type="date" required bind:value={start} class="block w-full border rounded p-2 bg-white dark:bg-gray-700" /></label>
    <label class="block">Data fine (facoltativa)<input type="date" min={start} bind:value={end} class="block w-full border rounded p-2 bg-white dark:bg-gray-700" /></label>
    <p class="text-xs">Giorno mensile assente: ultimo giorno del mese. Annuale: anniversario della data iniziale; 29 febbraio diventa 28 febbraio negli anni non bisestili.</p>
    <div class="flex gap-3"><button type="button" disabled={busy} onclick={()=>dialog.close()} class="border rounded p-2 flex-1">Annulla</button><button id="recSave" disabled={busy} class="bg-blue-600 text-white rounded p-2 flex-1">{busy?'Salvataggio…':'Salva'}</button></div>
  </form>
</dialog>
