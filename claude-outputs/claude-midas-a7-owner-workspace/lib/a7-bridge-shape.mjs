// The owner bridge forwards up to 12 files (14 MB in total: photos and specification files), exactly one product photo and at most one room photo.
// Refuse anything else here with a clear reason, before any claim, instead of letting the bridge fail mid-send.
export const BRIDGE_MAX_FILES=12,BRIDGE_MAX_BYTES=14*1024*1024;
export function bridgeShape(refs){
 const count=role=>refs.filter(r=>r.role===role).length,total=refs.reduce((n,r)=>n+Number(r.bytes||0),0);
 if(refs.length>BRIDGE_MAX_FILES)return `A7 takes at most ${BRIDGE_MAX_FILES} files per job; this version has ${refs.length}. Remove some in a new version. Nothing was sent.`;
 if(count('product')!==1)return 'A7 needs exactly one primary product photo per job. Nothing was sent.';
 if(count('room')>1)return 'A7 reads one room photo per job. Nothing was sent.';
 if(total>BRIDGE_MAX_BYTES)return `These files total ${(total/1048576).toFixed(1)} MB; A7 takes at most 14 MB per job. Use smaller files or fewer side views. Nothing was sent.`;
 return null;
}
