// Contract ready: stages 01–02 done. Stages 03–06 are not built yet, so the run stops here on purpose.
const s = $input.first().json;
return [{ json: { ...s, status: 'contract_ready', stage: '02 Compile scope', hold_reason: '', client_question: '',
  next: 'Stage 03 (retrieve and style, then owner Go 1) is not built yet. No paid image was made.' } }];
