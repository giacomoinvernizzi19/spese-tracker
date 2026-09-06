import {writable} from 'svelte/store';
export interface ReportSummary {expenses:number;income:number;monthlyAverage:number;difference:number|null;}
export const reportSummary=writable<ReportSummary|null>(null);
