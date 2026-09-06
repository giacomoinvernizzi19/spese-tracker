<script lang="ts">
  import { onMount } from 'svelte';
  type Item={id:number;date:string;amount:number;type:string;description:string;reason:string;matches:{id:number;description:string;source:string}[]};
  let items:Item[]=[];let total=0;let error='';let busy=false;
  async function load(){
    try {const response=await fetch('/api/bank/candidates');const data=await response.json();if(!response.ok)throw new Error(data.error);items=data.items;total=data.total;error='';}
    catch(e){error=e instanceof Error?e.message:'Caricamento non riuscito';}
  }
  async function resolve(item:Item,action:string,transaction_id?:number){
    if(busy)return;
    if(action==='import' && !confirm(item.reason==='identity_unverified'?'Identità non verificata: controlla che questa spesa non sia già presente. Importarla?':'Aggiungere questa nuova spesa ai totali?'))return;
    busy=true;
    try{const response=await fetch('/api/bank/candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,action,transaction_id,confirm_unverified:action==='import'})});const data=await response.json();if(!response.ok)throw new Error(data.error);await load();}
    catch(e){error=e instanceof Error?e.message:'Salvataggio non riuscito';}finally{busy=false;}
  }
  onMount(()=>{load();window.addEventListener('bank-synced',load);return()=>window.removeEventListener('bank-synced',load);});
</script>
<section class="mt-6 rounded-xl bg-white dark:bg-gray-800 p-4" aria-label="Movimenti da verificare">
  <div class="flex justify-between gap-3"><h2 class="font-semibold">Movimenti da verificare ({total})</h2><button class="text-blue-600" onclick={load} disabled={busy}>Aggiorna</button></div>
  <p class="text-sm my-2">Questi movimenti non sono ancora nei totali. Associa quelli già registrati oppure importa le nuove spese. Sono mostrati fino a 100 movimenti alla volta.</p>
  {#if error}<p role="alert" class="text-red-600">{error}</p>{/if}
  {#each items as item(item.id)}
    <article class="border-t py-3">
      <p>{item.date} · {item.amount.toLocaleString('it-IT',{style:'currency',currency:'EUR'})} · {item.type==='income'?'Entrata':'Uscita'}</p>
      <p class="break-words">{item.description}</p>
      {#if item.reason==='identity_unverified'}<p class="text-amber-700 text-sm">Identità non verificata: controlla anche i movimenti già importati.</p>{/if}
      <div class="flex flex-wrap gap-3 mt-2">
        <button class="text-blue-600" disabled={busy} onclick={()=>resolve(item,'import')}>Importa nuova spesa</button>
        <button class="text-gray-500" disabled={busy} onclick={()=>resolve(item,'ignore')}>Ignora</button>
        {#each item.matches as match}<button class="text-blue-600" disabled={busy} onclick={()=>resolve(item,'link',match.id)}>Associa a #{match.id}: {match.description}</button>{/each}
      </div>
    </article>
  {/each}
</section>
