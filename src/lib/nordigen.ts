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

export class NordigenClient {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl: string;

  constructor(private config: NordigenConfig) {
    this.baseUrl = config.baseUrl || 'https://bankaccountdata.gocardless.com/api/v2';
  }

  // Get or refresh access token
  async getToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const res = await fetch(`${this.baseUrl}/token/new/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret_id: this.config.secretId,
        secret_key: this.config.secretKey
      })
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Nordigen token error: ${res.status} - ${error}`);
    }

    const data = await res.json();
    this.accessToken = data.access;
    // Set expiry 60 seconds before actual expiry for safety margin
    this.tokenExpiry = new Date(Date.now() + (data.access_expires - 60) * 1000);
    return this.accessToken;
  }

  // List institutions for a country (default: Italy)
  async getInstitutions(country: string = 'IT'): Promise<Institution[]> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/institutions/?country=${country}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Nordigen institutions error: ${res.status} - ${error}`);
    }

    return res.json();
  }

  // Create a requisition (OAuth link for bank authorization)
  async createRequisition(
    institutionId: string,
    redirectUri: string,
    reference: string
  ): Promise<Requisition> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/requisitions/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        redirect: redirectUri,
        institution_id: institutionId,
        reference,
        user_language: 'IT'
      })
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Nordigen requisition error: ${res.status} - ${error}`);
    }

    return res.json();
  }

  // Get requisition status and account IDs
  async getRequisition(requisitionId: string): Promise<Requisition> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/requisitions/${requisitionId}/`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Nordigen requisition fetch error: ${res.status} - ${error}`);
    }

    return res.json();
  }

  // Delete a requisition (disconnect bank)
  async deleteRequisition(requisitionId: string): Promise<void> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/requisitions/${requisitionId}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok && res.status !== 404) {
      const error = await res.text();
      throw new Error(`Nordigen requisition delete error: ${res.status} - ${error}`);
    }
  }

  // Get account details
  async getAccountDetails(accountId: string): Promise<{ account: AccountDetails }> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}/details/`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Nordigen account details error: ${res.status} - ${error}`);
    }

    return res.json();
  }

  // Get account balances
  async getAccountBalances(accountId: string): Promise<{ balances: Balance[] }> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}/balances/`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Nordigen balances error: ${res.status} - ${error}`);
    }

    return res.json();
  }

  // Get account transactions
  async getTransactions(
    accountId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<TransactionsResponse> {
    const token = await this.getToken();
    let url = `${this.baseUrl}/accounts/${accountId}/transactions/`;
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (params.toString()) url += `?${params}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Nordigen transactions error: ${res.status} - ${error}`);
    }

    return res.json();
  }
}

// Helper to create client from environment
export function createNordigenClient(env: {
  NORDIGEN_SECRET_ID: string;
  NORDIGEN_SECRET_KEY: string;
}): NordigenClient {
  return new NordigenClient({
    secretId: env.NORDIGEN_SECRET_ID,
    secretKey: env.NORDIGEN_SECRET_KEY
  });
}
