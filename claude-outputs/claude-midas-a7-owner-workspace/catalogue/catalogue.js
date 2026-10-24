// Midas catalogue ("Choose from Midas"): browse the saved sitemap snapshot by category and source, select up to
// 10 products and import them into the Studio as Midas product references. Nothing is fetched from Midas here;
// Refresh is reserved for the data-feed import, which is not connected yet.
(()=>{
  'use strict';
  const data=window.MIDAS_CATALOGUE;
  const $=id=>document.getElementById(id);
  if(!data||!Array.isArray(data.products))return;
  const LIMIT=10, PAGE=36, KEY='midas-catalogue-import';
  const byId=new Map(data.categories.map(node=>[node.id,node]));
  const state={category:null,source:'All sources',categoryQuery:'',productQuery:'',visible:PAGE,selecting:false};
  const selected=new Map();
  const inOwner=location.pathname.startsWith('/owner/');
  const returnTo=(()=>{const value=new URLSearchParams(location.search).get('return')||'';return /^\/owner\/[\w\-/]*$/.test(value)?value:inOwner?'/owner/':'../index.html';})();
  $('back-link').href=returnTo;
  const pathFor=id=>{
    const names=[];const seen=new Set();
    while(id&&byId.has(id)&&!seen.has(id)){seen.add(id);const node=byId.get(id);names.unshift(node.name);id=node.parentId;}
    return names.join(' › ');
  };
  const isWithin=(category,parent)=>{
    if(parent==='unclassified')return category===null||category===undefined||category==='';
    const seen=new Set();
    while(category&&byId.has(category)&&!seen.has(category)){if(category===parent)return true;seen.add(category);category=byId.get(category).parentId;}
    return false;
  };
  const counts=new Map();
  const countFor=id=>{if(!counts.has(id))counts.set(id,data.products.reduce((count,item)=>count+(isWithin(item.categoryId,id)?1:0),0));return counts.get(id);};
  const categoryNodes=data.categories.filter(node=>node.kind!=='item-type');
  const skuOf=url=>(String(url).match(/-(\d{5,8})(?:-[a-z]+)?\.html$/i)||[])[1]||'';

  let statusTimer;
  function notify(text){const status=$('status');status.textContent=text;status.hidden=false;clearTimeout(statusTimer);statusTimer=setTimeout(()=>status.hidden=true,4500);}

  function renderSources(){
    const sources=['All sources',...new Set(data.products.map(item=>item.source))];
    $('sources').replaceChildren(...sources.map(source=>{
      const button=document.createElement('button');button.type='button';button.textContent=source;
      button.setAttribute('aria-pressed',String(state.source===source));
      button.addEventListener('click',()=>{state.source=source;state.visible=PAGE;render();});
      return button;
    }));
  }
  function renderCategories(){
    const query=state.categoryQuery.toLocaleLowerCase();
    const matched=categoryNodes.filter(node=>pathFor(node.id).toLocaleLowerCase().includes(query));
    const fragment=document.createDocumentFragment();
    const all=document.createElement('button');all.type='button';all.textContent=`All categories · ${data.products.length.toLocaleString()}`;
    all.setAttribute('aria-current',String(state.category===null));
    all.addEventListener('click',()=>{state.category=null;state.visible=PAGE;render();});fragment.append(all);
    for(const node of matched){
      const button=document.createElement('button');button.type='button';
      const depth=Math.max(0,pathFor(node.id).split(' › ').length-1);
      button.dataset.depth=String(Math.min(depth,4));
      button.setAttribute('aria-current',String(state.category===node.id));
      button.title=pathFor(node.id);
      const name=document.createElement('span');name.textContent=node.name;
      const count=document.createElement('small');count.textContent=`${countFor(node.id).toLocaleString()} matched products`;
      button.append(name,count);
      button.addEventListener('click',()=>{state.category=node.id;state.visible=PAGE;render();});
      fragment.append(button);
    }
    if(!query){
      const unmatched=document.createElement('button');unmatched.type='button';
      unmatched.textContent=`Unclassified · ${countFor('unclassified').toLocaleString()}`;
      unmatched.setAttribute('aria-current',String(state.category==='unclassified'));
      unmatched.addEventListener('click',()=>{state.category='unclassified';state.visible=PAGE;render();});
      fragment.append(unmatched);
    }
    $('categories').replaceChildren(fragment);
  }
  function matchingProducts(){
    const query=state.productQuery.toLocaleLowerCase().trim();
    return data.products.filter(item=>(state.source==='All sources'||item.source===state.source)
      &&(!state.category||isWithin(item.categoryId,state.category))
      &&(!query||item.name.toLocaleLowerCase().includes(query)));
  }

  // Selection: a card can be selected with its checkbox or by clicking the card itself (links keep working).
  function toggle(item,force){
    const has=selected.has(item.url),want=force===undefined?!has:force;
    if(want&&!has){
      if(selected.size>=LIMIT){notify(`You can import up to ${LIMIT} products at a time. Deselect one to add another.`);syncCards();return;}
      selected.set(item.url,item);
    }else if(!want&&has)selected.delete(item.url);
    syncSelection();
  }
  function productCard(item){
    const article=document.createElement('article');article.className='product-card';article.dataset.url=item.url;
    const type=document.createElement('div');type.className='product-type';
    type.textContent=item.categoryId?pathFor(item.categoryId):'Category not verified';
    const title=document.createElement('h3');title.textContent=item.name;
    const source=document.createElement('div');source.className='product-source';source.textContent=item.source;
    const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View on Midas ↗';
    if(state.selecting){
      const box=document.createElement('label');box.className='select-box';
      const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',`Select ${item.name}`);
      input.addEventListener('change',()=>toggle(item,input.checked));
      const mark=document.createElement('span');mark.setAttribute('aria-hidden','true');
      box.append(input,mark);article.append(box);
      article.classList.add('is-selectable');
      article.addEventListener('click',event=>{if(event.target.closest('a,label,input,button'))return;toggle(item);});
    }
    article.append(type,title,source,link);
    return article;
  }
  function syncCards(){
    const full=selected.size>=LIMIT;
    for(const card of $('product-grid').children){
      const on=selected.has(card.dataset.url),input=card.querySelector('.select-box input');
      card.classList.toggle('is-selected',on);
      if(input){input.checked=on;input.disabled=!on&&full;card.classList.toggle('is-locked',!on&&full);}
    }
  }
  function syncSelection(){
    syncCards();
    const count=selected.size;
    $('select-count').textContent=`${count} of ${LIMIT} selected`;
    $('deselect-all').disabled=$('tray-clear').disabled=!count;
    const importButton=$('import-selected');importButton.disabled=!count;
    importButton.textContent=count?`Import ${count} product${count===1?'':'s'}`:'Import selected';
    $('select-all').disabled=count>=LIMIT;
    $('selected-list').replaceChildren(...[...selected.values()].map(item=>{
      const li=document.createElement('li');const name=document.createElement('span');name.textContent=item.name;
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${item.name}`);
      remove.addEventListener('click',()=>{toggle(item,false);(($('selected-list').querySelector('button'))||$('import-selected')).focus();});
      li.append(name,remove);return li;
    }));
  }
  function setSelecting(on){
    state.selecting=on;
    $('select-toggle').setAttribute('aria-pressed',String(on));
    $('select-toggle').textContent=on?'Done selecting':'Select products';
    $('select-actions').hidden=!on;$('select-tray').hidden=!on;
    document.body.classList.toggle('is-selecting',on);
    renderResults();
  }
  $('select-toggle').addEventListener('click',()=>setSelecting(!state.selecting));
  $('select-all').addEventListener('click',()=>{
    const matches=matchingProducts();let added=0;
    for(const item of matches){if(selected.size>=LIMIT)break;if(!selected.has(item.url)){selected.set(item.url,item);added++;}}
    syncSelection();
    const remaining=matches.filter(item=>!selected.has(item.url)).length;
    notify(remaining?`Selected ${added} product${added===1?'':'s'}. Imports are limited to ${LIMIT} at a time, so ${remaining.toLocaleString()} matching products were left out.`:`Selected ${added} product${added===1?'':'s'}.`);
  });
  const clear=()=>{selected.clear();syncSelection();notify('Selection cleared.');};
  $('deselect-all').addEventListener('click',clear);$('tray-clear').addEventListener('click',clear);

  // Import hands the selection to the Studio: stored for a Studio tab that is already open, and carried in the
  // return address for this tab. The Studio keeps them as Midas product references only (not verified products).
  $('import-selected').addEventListener('click',()=>{
    if(!selected.size)return;
    const payload={source:'midas-catalogue',snapshot:data.snapshotDate,at:new Date().toISOString(),
      items:[...selected.values()].slice(0,LIMIT).map(item=>({name:item.name,url:item.url,sku:skuOf(item.url),category:item.categoryId?pathFor(item.categoryId):''}))};
    try{localStorage.setItem(KEY,JSON.stringify(payload));}catch{}
    const opener=(()=>{try{return window.opener&&window.opener.location.origin===location.origin?window.opener:null;}catch{return null;}})();
    if(opener){try{opener.focus();}catch{}window.close();}
    location.href=`${returnTo}#catalogue-import=${encodeURIComponent(JSON.stringify({...payload,items:payload.items.map(({name,url,sku})=>({name,url,sku}))}))}`;
  });

  function renderResults(){
    const categoryName=state.category==='unclassified'?'Unclassified':state.category?byId.get(state.category)?.name||'All categories':'All categories';
    $('breadcrumb').textContent=state.category&&state.category!=='unclassified'?pathFor(state.category):categoryName;
    $('result-title').textContent=categoryName;
    $('source-label').textContent=state.source;
    const matches=matchingProducts();
    $('result-count').textContent=`${matches.length.toLocaleString()} products`;
    $('product-grid').replaceChildren(...matches.slice(0,state.visible).map(productCard));
    $('no-matches').hidden=matches.length!==0;
    $('load-more').hidden=matches.length<=state.visible;
    $('shown-count').textContent=matches.length?`Showing ${Math.min(state.visible,matches.length).toLocaleString()} of ${matches.length.toLocaleString()}`:'';
    syncSelection();
  }
  function render(){renderSources();renderCategories();renderResults();}
  $('search').addEventListener('input',event=>{state.categoryQuery=event.target.value;renderCategories();});
  $('product-search').addEventListener('input',event=>{state.productQuery=event.target.value;state.visible=PAGE;renderResults();});
  $('load-more').addEventListener('click',()=>{state.visible+=PAGE;renderResults();});
  $('refresh').addEventListener('click',()=>notify('Refresh will import the latest products from the Midas data feed URL. That import is planned for later and is not connected yet, so this is still the 19 October 2026 snapshot.'));
  render();
  if(new URLSearchParams(location.search).get('select')==='1')setSelecting(true);
})();
