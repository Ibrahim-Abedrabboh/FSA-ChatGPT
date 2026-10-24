function requirePreservedReader(state,response){
 if(state?.reader_recovery!==true||state.room_key||
    !Number.isSafeInteger(state.cached_second?.total)||state.cached_second.total<1||
    response?.__budgetAllowed!==true||response?.__readerResponsePreserved!==true||
    response.status!=='completed'||!Array.isArray(response.output))
  throw Error('reader_continuation_not_ready_no_resend');
 return response;
}
const it=$input.first();requirePreservedReader($('02 Ingest files').first().json,it.json);return [it];