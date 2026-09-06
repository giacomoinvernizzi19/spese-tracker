<script lang="ts">
  import * as XLSX from 'xlsx';
  import {importAmount,importDate,importDigest} from '../lib/import';
  import {requestJson} from '../lib/client';
  type Category={id:number;name:string;parent_id:number|null;children?:Category[]};
  type Mapping={date:string;amount:string;category:string;sub:string;description:string};
  const fields:{key:keyof Mapping;label:string;optional?:boolean}[]=[{key:'date',label:'Data'},{key:'amount',label:'Importo'},{key:'category',label:'Categoria'},{key:'sub',label:'Sottocategoria',optional:true},{key:'description',label:'Descrizione',optional:true}];
  let headers:string[]=[];let rows:unknown[][]=[];let digest='';let version=0;
  let mapping:Mapping={date:'0',amount:'0',category:'0',sub:'',description:''};
  let loading=false,busy=false,processed=0,imported=0,duplicates=0,finished=false;
  let error='';let errors:string[]=[];let input:HTMLInputElement;let excel1904=false;
  async function read(file?:File){
    if(!file||busy)return;
    const current=++version;headers=[];rows=[];digest='';error='';finished=false;loading=true;
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());const hash=await importDigest(bytes);
      const workbook=XLSX.read(bytes,{type:'array',raw:true});
      const data=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]],{header:1});
      if(current!==version)return;
      const parsed=data.slice(1).filter(row=>row.some(value=>value!==undefined&&value!==''));
      if(!parsed.length)throw new Error('File vuoto o senza dati');
      headers=data[0].map(String);rows=parsed;digest=hash;excel1904=!!workbook.Workbook?.WBProps?.date1904;
      const detect=(terms:string[],fallback='')=>{const index=headers.findIndex(h=>terms.some(term=>h.toLowerCase().includes(term)));return index<0?fallback:String(index);};
      mapping={date:detect(['data','date'],'0'),amount:detect(['importo','amount','$'],'0'),category:detect(['categoria','category'],'0'),sub:detect(['sottocategoria','subcategory']),description:detect(['descr','note','item'])};
    }catch(e){if(current===version)error=e instanceof Error?e.message:'File non leggibile';}
    finally{if(current===version)loading=false;}
  }
  async function importRows(){
    if(busy||!digest)return;busy=true;error='';errors=[];imported=0;duplicates=0;processed=0;finished=false;
    try{
      const categories=await requestJson<Category[]>('/api/categories?hierarchical=true');
      async function category(name:string,parent:number|null=null):Promise<number>{
        const list=parent===null?categories:categories.find(c=>c.id===parent)?.children ?? [];
        const found=list.find(c=>c.name.toLowerCase()===name.toLowerCase());if(found)return found.id;
        const result=await requestJson<{id:number}>('/api/categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,parent_id:parent})});
        const created:Category={id:result.id,name,parent_id:parent,children:[]};
        if(parent===null)categories.push(created);else{const owner=categories.find(c=>c.id===parent)!;owner.children ??=[];owner.children.push(created);}
        return created.id;
      }
      for(const [index,row] of rows.entries()){
        try{
          const rawDate=row[Number(mapping.date)];
          const date=importDate(typeof rawDate==='number'&&excel1904?rawDate+1462:rawDate),amount=importAmount(row[Number(mapping.amount)]);
          const name=String(row[Number(mapping.category)]??'').trim();if(!name)throw new Error('Categoria mancante');
          let parent=name,sub=mapping.sub?String(row[Number(mapping.sub)]??'').trim():'';
          if(!sub){for(const separator of [' > ',' / ',' - ',' : ']){const parts=name.split(separator).map(p=>p.trim());if(parts.length>=2&&parts[0]&&parts[1]){[parent,sub]=parts;break;}}}
          const parentId=await category(parent);const categoryId=sub?await category(sub,parentId):parentId;
          const result=await requestJson<{duplicate:boolean}>('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,date,type:'expense',category_id:categoryId,description:mapping.description?String(row[Number(mapping.description)]??''):'',source:'import',import_batch_id:digest,import_row_id:index})});
          if(result.duplicate)duplicates++;else imported++;
        }catch(e){errors=[...errors,`Riga dati ${index+1}: ${e instanceof Error?e.message:'Riga non salvata'}`];}
        processed=index+1;
      }
      finished=true;
    }catch(e){error=e instanceof Error?e.message:'Importazione non riuscita';}finally{busy=false;}
  }
</script>
<div class="rounded-xl bg-white dark:bg-gray-800 p-4 sm:p-6">
  <h2 class="text-xl font-semibold mb-3">Importa da Excel</h2>
  <p class="text-sm mb-4">La prima scheda deve avere intestazioni e colonne Data, Importo e Categoria. Descrizione e sottocategoria sono facoltative. Importiamo solo spese in euro; le righe non valide vengono indicate e puoi ritentarle.</p>
  <div role="region" aria-label="Caricamento Excel" ondragover={event=>event.preventDefault()} ondrop={event=>{event.preventDefault();read(event.dataTransfer?.files[0]);}} class="border-2 border-dashed rounded-xl p-5 text-center">
    <label for="fileInput" class="block mb-2">Trascina qui il file oppure selezionalo</label>
    <input id="fileInput" type="file" accept=".xlsx,.xls" bind:this={input} disabled={busy} onchange={()=>read(input.files?.[0])} class="max-w-full" />
  </div>
  {#if loading}<p role="status">Lettura del file…</p>{/if}
  {#if error}<p role="alert" class="my-3 text-red-600">{error}</p>{/if}
  {#if rows.length}
    <section id="preview" class="mt-5">
      <h3 class="font-semibold">Anteprima ({rows.length} righe)</h3>
      <div class="overflow-x-auto"><table class="text-sm w-full"><thead><tr>{#each headers as header}<th class="p-2 text-left">{header}</th>{/each}</tr></thead><tbody id="previewBody">{#each rows.slice(0,5) as row}<tr>{#each headers as _,i}<td class="p-2 border-t">{String(row[i]??'')}</td>{/each}</tr>{/each}</tbody></table></div>
      <div class="grid sm:grid-cols-2 gap-3 mt-4">
        {#each fields as field}<label class="text-sm">Colonna {field.label}<select id={`${field.key}Col`} bind:value={mapping[field.key]} disabled={busy} class="block w-full rounded border p-2 bg-white dark:bg-gray-700">{#if field.optional}<option value="">Nessuna / rilevamento automatico</option>{/if}{#each headers as header,i}<option value={String(i)}>{header}</option>{/each}</select></label>{/each}
      </div>
      <p class="text-sm mt-3">Per le sottocategorie riconosciamo anche «Ristoranti &gt; Pranzo». Cambiare le colonne non duplica le righe già salvate: eventuali differenze vengono segnalate.</p>
      <button id="importBtn" class="w-full bg-blue-600 text-white rounded-xl p-3 mt-4 disabled:opacity-50" disabled={busy} onclick={importRows}>{busy?'Importazione…':finished?'Riprova importazione':'Importa spese'}</button>
    </section>
  {/if}
  {#if busy}<progress class="w-full mt-3" value={processed} max={rows.length}></progress><p role="status">{processed} / {rows.length} righe elaborate</p>{/if}
  {#if finished}<p id="success" role="status" class="mt-4">{imported} righe importate, {duplicates} già presenti, {errors.length} rifiutate.</p><a href="/" class="text-blue-600">Vai alla dashboard</a>{/if}
  {#if errors.length}<ul class="text-red-600 text-sm mt-3" aria-label="Righe rifiutate">{#each errors as message}<li>{message}</li>{/each}</ul>{/if}
</div>
