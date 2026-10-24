// Runs the owner site's own JavaScript against what the Python engine produced.
// Usage: node crosscheck.mjs <workspace-dir> <mode> <input.json>
//   prepare: quote and intent exactly as productionReader.run builds them
//   verify:  quoteCall on every reservation, normalizeAnswer on every settlement,
//            then verifiedAnalysisAnswers, observationFromVerifiedAnswers and analysisReceipt
// Reads only local files; makes no network call.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const [workspace, mode, inputFile] = process.argv.slice(2);
const lib = name => import(pathToFileURL(path.join(workspace, 'lib', name)).href);
const input = JSON.parse(await readFile(inputFile, 'utf8'));
const {canonical} = await lib('a7-actions.mjs');
const {quoteSourceAnalysis} = await lib('a7-analysis-quote.mjs');
const {analysisIntent, analysisReceipt} = await lib('a7-source-understanding.mjs');
const out = {};

if (mode === 'prepare') {
  const quote = quoteSourceAnalysis(input.source);
  const intent = analysisIntent({requestId: input.requestId, draftId: input.source.draftId, sourceSha256: input.source.sourceSha256, ...(input.source.roomSha256 ? {roomSha256: input.source.roomSha256} : {}), maxCostUsd: quote.maxCostUsd, confirmed: true});
  out.quote = quote;
  out.intent = intent;
  out.canonical = (input.canonicalSamples || []).map(v => canonical(v));
  out.stringify = (input.canonicalSamples || []).map(v => JSON.stringify(v));
} else {
  const {quoteCall} = await lib('a7-budget.mjs');
  const {normalizeAnswer} = await lib('a7-answer-checkpoints.mjs');
  const {verifiedAnalysisAnswers} = await lib('a7-analysis-ledger.mjs');
  const {observationFromVerifiedAnswers} = await lib('a7-analysis-observation.mjs');
  const sha = v => createHash('sha256').update(canonical(v)).digest('hex');
  out.quotes = input.reserves.map(r => { try { return {ok: true, reserve: quoteCall(r).reserve}; } catch (e) { return {ok: false, error: e.message}; } });
  out.operationKeys = input.reserves.map(r => 'a7:' + sha({client: r.clientId, run: r.runId, node: r.node, output: 'job', attempt: 0, phase: '', go1: 0, go2: 0, plan: 0, rewrite: 0, review: 0}));
  const rows = input.reserves.map((r, i) => {
    const s = input.settles[i];
    const n = normalizeAnswer(s.completeAnswer, {node_name: r.node, model: r.model, operation_key: r.operationKey}, s.usage, s.receiptRef);
    return {operation_key: r.operationKey, client_run_id: r.clientId, run_id: r.runId, node_name: r.node, status: 'completed', receipt_ref: s.receiptRef, reader_response: n.checkpoint, reader_response_sha256: n.sha256};
  });
  const ids = {client_run_id: input.reserves[0].clientId, run_id: input.reserves[0].runId};
  const pool = {query: async sql => ({rows: sql.includes('FROM a7_owner_budgets') ? [{...ids, owner_id: input.ownerId, limit_micro_usd: Math.round(input.source.budgetLimitUsd * 1e6)}] : rows})};
  const answers = await verifiedAnalysisAnswers(pool, input.ownerId, input.source, input.response);
  const observed = observationFromVerifiedAnswers(input.source, answers);
  const receipt = analysisReceipt(input.intent, {...input.response, ...observed});
  out.observation = receipt.observation;
  out.roomObservation = receipt.roomObservation;
  out.conflictFindings = observed.conflictFindings;
}
process.stdout.write(JSON.stringify(out));
