// Nordigen/GoCardless Bank Account Data API Client

export interface NordigenConfig {
  secretId: string;
  secretKey: string;
  baseUrl?: string;
}

export interface Institution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  countries: string[];
}

export interface Requisition {
  id: string;
  status: string;
  link: string;
  accounts: string[];
  reference: string;
  institution_id: string;
  agreement: string;
}

export interface AccountDetails {
  resourceId: string;
  iban?: string;
  name?: string;
  ownerName?: string;
  currency?: string;
}

export interface Balance {
  balanceAmount: {
    amount: string;
    currency: string;
  };
  balanceType: string;
}

export interface Transaction {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  remittanceInformationUnstructured?: string;
  creditorName?: string;
  debtorName?: string;
}

export interface TransactionsResponse {
  transactions: {
    booked: Transaction[];
    pending?: Transaction[];
  };
}

export interface Agreement { accepted: string; access_valid_for_days: number; max_historical_days: number; institution_id: string; }
export class ProviderError extends Error {
  constructor(public status: number,public retryAfter: string|null=null) { super('Bank provider request failed'); this.name='ProviderError'; }
}
export class NordigenClient {
  private accessToken: string|null=null;
  private expiresAt=0;
  private baseUrl: string;
  constructor(private config: NordigenConfig) { this.baseUrl=config.baseUrl ?? 'https://bankaccountdata.gocardless.com/api/v2'; }
  private async request<T>(path:string,init:RequestInit={},authenticated=true):Promise<T> {
    const headers=new Headers(init.headers);
    headers.set('Content-Type','application/json');
    if(authenticated) headers.set('Authorization',`Bearer ${await this.getToken()}`);
    let response:Response;
    try { response=await fetch(this.baseUrl+path,{...init,headers,signal:AbortSignal.timeout(20000)}); }
    catch { throw new ProviderError(503); }
    if(!response.ok) throw new ProviderError(response.status,response.headers.get('Retry-After'));
    if(response.status===204) return undefined as T;
    try { return await response.json() as T; } catch { throw new ProviderError(502); }
  }
  async getToken():Promise<string> {
    if(this.accessToken && Date.now()<this.expiresAt) return this.accessToken;
    let data=await this.request<{access?:string;access_expires?:number;refresh?:string}>('/token/new/',{method:'POST',body:JSON.stringify({secret_id:this.config.secretId,secret_key:this.config.secretKey})},false);
    if(!data.access && data.refresh) data=await this.request('/token/refresh/',{method:'POST',body:JSON.stringify({refresh:data.refresh})},false);
    if(typeof data.access!=='string' || !data.access || typeof data.access_expires!=='number' || data.access_expires<=0) throw new ProviderError(502);
    this.accessToken=data.access;this.expiresAt=Date.now()+Math.max(0,data.access_expires-60)*1000;
    return data.access;
  }
  getInstitutions(country='IT') { return this.request<Institution[]>(`/institutions/?country=${encodeURIComponent(country)}`); }
  createRequisition(institutionId:string,redirect:string,reference:string) { return this.request<Requisition>('/requisitions/',{method:'POST',body:JSON.stringify({institution_id:institutionId,redirect,reference,user_language:'IT'})}); }
  getRequisition(id:string) { return this.request<Requisition>(`/requisitions/${encodeURIComponent(id)}/`); }
  getAgreement(id:string) { return this.request<Agreement>(`/agreements/enduser/${encodeURIComponent(id)}/`); }
  async deleteRequisition(id:string) { try { await this.request(`/requisitions/${encodeURIComponent(id)}/`,{method:'DELETE'}); } catch(error) { if(!(error instanceof ProviderError && error.status===404)) throw error; } }
  getAccountDetails(id:string) { return this.request<{account:AccountDetails}>(`/accounts/${encodeURIComponent(id)}/details/`); }
  getAccountBalances(id:string) { return this.request<{balances:Balance[]}>(`/accounts/${encodeURIComponent(id)}/balances/`); }
  getTransactions(id:string,dateFrom?:string,dateTo?:string) {
    const params=new URLSearchParams();if(dateFrom)params.set('date_from',dateFrom);if(dateTo)params.set('date_to',dateTo);
    return this.request<TransactionsResponse>(`/accounts/${encodeURIComponent(id)}/transactions/?${params}`);
  }
}
import { InputError } from './validation';
export function createNordigenClient(env:{NORDIGEN_SECRET_ID?:string;NORDIGEN_SECRET_KEY?:string}):NordigenClient {
  if(!env.NORDIGEN_SECRET_ID || !env.NORDIGEN_SECRET_KEY) throw new InputError('Collegamento bancario non configurato',503);
  return new NordigenClient({secretId:env.NORDIGEN_SECRET_ID,secretKey:env.NORDIGEN_SECRET_KEY});
}
