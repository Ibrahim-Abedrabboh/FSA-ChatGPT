// Edit phase 2.3: the options panel of an edit. The owner picks up to two changes from fixed lists, adds an
// optional short note, and unticks what may change in a keep list built from the confirmed source facts.
// Each option becomes one fixed line, so the request cannot contradict the "keep the product" rule and A7's
// review can check it. The panel writes the two existing fields (what should change, what must stay the
// same), which stay editable, and a compact code of the choices for A7 (#editOptions).
(function(root){
  const OPTIONS=[
    {kind:'lighting',label:'Lighting',values:['Daylight','Golden afternoon','Warm evening'],line:v=>`Lighting: change the light to the ${v} preset.`,frees:'scene:lighting'},
    {kind:'wall',label:'Wall colour',values:['White','Ivory','Sand','Greige','Taupe','Sage','Charcoal','Terracotta'],line:v=>`Walls: paint the walls ${v}.`,frees:'scene:walls'},
    {kind:'floor',label:'Floor',values:['Light oak','Dark walnut','Limestone','Marble'],line:v=>`Floor: change the floor to ${v}.`,frees:'scene:floor'},
    {kind:'camera',label:'Camera view',values:['Reference view','Full frontal','45° right'],line:v=>`Camera: show the scene from the ${v}; the room, pieces and light stay.`,frees:'scene:camera'},
    {kind:'props',label:'Props',values:['Remove all','Fewer'],line:v=>v==='Remove all'?'Props: remove every Midas piece and prop; keep only the product and the room.':'Props: keep at most one Midas piece and remove the rest.',frees:'scene:props'},
    {kind:'defect',label:'Fix a defect',values:null,line:v=>`Fix this defect: ${v}.`,frees:null}
  ];
  const SCENE=[['scene:camera','The camera angle and framing'],['scene:walls','The walls'],['scene:floor','The floor and the rug'],['scene:lighting','The lighting'],['scene:props','The Midas pieces and props where they stand']];
  const MAX_OPTIONS=2,FIELD=600,NOTE=300,VALUE=80;
  const clean=(v,n)=>String(v??'').replace(/[|=]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
  const dot=t=>/[.!?]$/.test(t)?t:t+'.';
  // The keep list from the owner-confirmed facts: the product pieces and the identifying details, then the scene.
  function keepItems(facts){
    const items=[],counts=new Map();
    for(const p of Array.isArray(facts?.pieces)?facts.pieces:[])if(p&&p.role==='product'){const k=clean(p.kind||p.label,60);if(k)counts.set(k,(counts.get(k)||0)+1);}
    if(counts.size)items.push({id:'product',text:'The product: '+[...counts].map(([k,n])=>n+' x '+k).join(', ')});
    else if(Number.isInteger(facts?.physicalCount))items.push({id:'product',text:`The product: ${facts.physicalCount} piece${facts.physicalCount===1?'':'s'} exactly as photographed`});
    for(const [i,a] of (Array.isArray(facts?.visibleAttributes)?facts.visibleAttributes:[]).slice(0,8).entries()){const t=clean(a,140);if(t)items.push({id:'detail:'+i,text:t});}
    for(const [id,text] of SCENE)items.push({id,text});
    return items;
  }
  // choices: [{kind,value}], up to two. kept: ids of keep items still ticked. Returns the two field texts and the code.
  function compose({choices=[],note='',items=[],kept=null}){
    const picked=[];
    for(const c of choices){const o=OPTIONS.find(x=>x.kind===c?.kind),v=clean(c?.value,VALUE);if(!o||!v||picked.some(p=>p.o.kind===o.kind)||(o.values&&!o.values.includes(v)))continue;picked.push({o,v});}
    if(picked.length>MAX_OPTIONS)throw Error('Choose at most two changes per edit.');
    const n=clean(note,NOTE);
    const changes=[...picked.map(({o,v})=>o.line(v)),...(n?['Note: '+dot(n)]:[])].join(' ').slice(0,FIELD);
    const freed=new Set(picked.map(({o})=>o.frees).filter(Boolean));
    const keepSet=kept?new Set(kept):null;
    const parts=[];let length=0;
    for(const item of items){
      if(freed.has(item.id)||(keepSet&&!keepSet.has(item.id)))continue;
      const t=item.text;if(length+t.length+2>FIELD)break;parts.push(t);length+=t.length+2;
    }
    return {changes,preserve:parts.join('; '),code:picked.map(({o,v})=>o.kind+'='+v).join('|'),freed:[...freed]};
  }
  // The code A7 receives: "kind=value|kind=value". Anything else is refused.
  function parseCode(code){
    if(code===undefined||code==='')return [];
    if(typeof code!=='string'||code.length>200)throw Error('invalid_edit_options');
    const out=code.split('|').map(part=>{const m=/^(lighting|wall|floor|camera|props|defect)=([^|=]{1,80})$/.exec(part);if(!m)throw Error('invalid_edit_options');return {kind:m[1],value:m[2]};});
    if(out.length>MAX_OPTIONS||new Set(out.map(x=>x.kind)).size!==out.length)throw Error('invalid_edit_options');
    for(const x of out){const o=OPTIONS.find(y=>y.kind===x.kind);if(o.values&&!o.values.includes(x.value))throw Error('invalid_edit_options');}
    return out;
  }
  const api={OPTIONS,SCENE,MAX_OPTIONS,keepItems,compose,parseCode};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.a7EditOptions=api;
  const doc=root.document;
  if(!doc||typeof doc.getElementById!=='function')return;
  function mount(){
    const setup=doc.getElementById('editSetup');if(!setup||doc.getElementById('editOptionsPanel'))return;
    const make=(tag,props={},kids=[])=>{const el=doc.createElement(tag);Object.assign(el,props);for(const k of kids)el.append(k);return el;};
    const panel=make('div',{id:'editOptionsPanel',className:'edit-options'});
    const pick=make('fieldset',{},[make('legend',{textContent:'What to change (up to two)'})]);
    const status=make('p',{className:'option-note',id:'editOptionsStatus'});status.setAttribute('role','status');
    const rows=OPTIONS.map(o=>{
      const box=make('input',{type:'checkbox',id:'editOpt-'+o.kind});
      const input=o.values?make('select',{id:'editOptValue-'+o.kind},o.values.map(v=>make('option',{value:v,textContent:v}))):make('input',{type:'text',id:'editOptValue-'+o.kind,maxLength:VALUE,placeholder:'Describe the defect in the image'});
      input.setAttribute('aria-label',o.label+' choice');
      const row=make('div',{className:'edit-option-row'},[make('label',{className:'edit-option-pick'},[box,doc.createTextNode(' '+o.label)]),input]);
      pick.append(row);return {o,box,input};
    });
    const note=make('input',{type:'text',id:'editOptionsNote',maxLength:NOTE,placeholder:'Optional: anything else, in a short sentence'});
    const noteLabel=make('label',{},[doc.createTextNode('Note (optional, up to 300 characters)'),note]);
    const keep=make('fieldset',{id:'editKeepList',className:'edit-keep'},[make('legend',{textContent:'Keep unchanged (untick what may change)'})]);
    const code=make('input',{type:'hidden',id:'editOptions'});
    panel.append(pick,noteLabel,keep,status,code,make('p',{className:'option-note',textContent:'The two fields below are written from these choices. You can still edit them.'}));
    setup.insertBefore(panel,setup.querySelector('label'));
    let items=keepItems(null),kept=null;
    function renderKeep(freed){
      keep.querySelectorAll('label').forEach(l=>l.remove());
      for(const item of items){
        const box=make('input',{type:'checkbox',checked:!freed.includes(item.id)&&(!kept||kept.has(item.id)),value:item.id});
        box.disabled=freed.includes(item.id);
        box.addEventListener('change',()=>{kept=new Set([...keep.querySelectorAll('input:checked')].map(b=>b.value));update(false);});
        keep.append(make('label',{className:'edit-keep-item'},[box,doc.createTextNode(' '+item.text+(box.disabled?' (changes with your choice)':''))]));
      }
    }
    function update(redrawKeep=true){
      const chosen=rows.filter(r=>r.box.checked);
      for(const r of rows)r.box.disabled=!r.box.checked&&chosen.length>=MAX_OPTIONS;
      let result;
      try{result=compose({choices:chosen.map(r=>({kind:r.o.kind,value:r.input.value})),note:note.value,items,kept:kept?[...kept]:null});}
      catch(error){status.textContent=error.message;return;}
      status.textContent=chosen.length>=MAX_OPTIONS?'Two changes chosen: untick one to pick another.':'';
      if(redrawKeep)renderKeep(result.freed);
      code.value=result.code;
      const changes=doc.getElementById('editChanges'),preserve=doc.getElementById('editPreserve');
      if(changes&&(result.changes||chosen.length))changes.value=result.changes;
      if(preserve)preserve.value=result.preserve;
      for(const id of ['editChanges','editPreserve'])doc.getElementById(id)?.dispatchEvent(new Event('input',{bubbles:true}));
    }
    for(const r of rows){r.box.addEventListener('change',()=>update());r.input.addEventListener('change',()=>update());r.input.addEventListener('input',()=>{if(r.box.checked)update(false);});}
    note.addEventListener('input',()=>update(false));
    // Edit phase 2.5: "Retry this edit" restores the choices of the edit being retried (start-connected.js).
    doc.addEventListener('a7:edit-options-restore',event=>{
      let picks;try{picks=parseCode(event.detail?.code||'');}catch{picks=[];}
      for(const r of rows){const p=picks.find(x=>x.kind===r.o.kind);r.box.checked=!!p;if(p)r.input.value=p.value;}
      update();
    });
    // The page sends the owner-confirmed facts of the source once they are known (start-connected.js).
    doc.addEventListener('a7:source-facts',event=>{items=keepItems(event.detail);kept=null;renderKeep(rows.filter(r=>r.box.checked).map(r=>r.o.frees).filter(Boolean));});
    renderKeep([]);
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount);else mount();
})(typeof globalThis!=='undefined'?globalThis:this);
