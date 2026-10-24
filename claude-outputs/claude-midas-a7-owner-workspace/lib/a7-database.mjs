import {getDatabase} from '@netlify/database';
export const budgetPool=()=>getDatabase().pool;
