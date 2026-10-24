const bounded=(v,n=350)=>typeof v==='string'&&v.trim()?v.trim().slice(0,n):null;
const list=(v,n=20)=>Array.isArray(v)?v.slice(0,n).map(x=>bounded(x)).filter(Boolean):[];
const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=199?v:null;

export function observationFromVerifiedAnswers(source,answers){
 const eye=answers['03 Eye reads the product photo'],second=answers['05 Second count'],room=answers['06 Room reader'],conflict=answers['09 Conflict check'];
 if(!eye||!second||!conflict||Boolean(room)!==Boolean(source.roomSha256))throw Error('analysis_receipt_unverified');
 const pieces=(Array.isArray(eye.pieces)?eye.pieces:[]).slice(0,60).filter(p=>p&&['product','excluded','context'].includes(p.role)&&bounded(p.label,100)&&bounded(p.kind,80)).map(p=>({label:bounded(p.label,100),kind:bounded(p.kind,80),role:p.role}));
 const eyeCount=positive(pieces.filter(p=>p.role==='product').length),secondCount=positive(second.total);
 const category=bounded(eye.category,120);
 if(!category||!eyeCount||!secondCount)throw Error('analysis_receipt_unverified');
 const visibleAttributes=[bounded(eye.colour_observed,180),bounded(eye.material_appearance,180),...list(eye.design_locks,18)].filter(Boolean).slice(0,20);
 const observation={category,eyeCount,secondCount,statedCount:null,visibleSeatCount:null,pieces,visibleAttributes,uncertainties:list(eye.unknowns)};
 const roomObservation=room?{sourceSha256:source.roomSha256,roomType:bounded(room.room_type,120),walls:bounded(room.walls),floor:bounded(room.floor),windows:bounded(room.windows),doors:bounded(room.doors),builtIns:bounded(room.built_ins),freeFloorZone:bounded(room.free_floor_zone),fixedObjects:list(room.fixed_objects),unknowns:list(room.unknowns)}:null;
 const conflictFindings=(Array.isArray(conflict.conflicts)?conflict.conflicts:[]).slice(0,20).map(c=>bounded(typeof c==='string'?c:[c?.topic,c?.severity,c?.reason].filter(Boolean).join(': '))).filter(Boolean);
 return {observation,roomObservation,conflictFindings};
}
