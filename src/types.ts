export interface QuoteItem {
  id: string | number;
  name: string;
  quantity: number;
  unit: string;
  supplier: string;
  notes?: string;
}

export interface CustomerInfo {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
}

export interface AddressInfo {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  fullAddress: string;
}

export interface QuoteData {
  id: string | number;
  quoteNumber: string; // E.g., QT_1001
  customer: CustomerInfo;
  address: AddressInfo;
  plannedWorksDate: string; // ISO or human-readable
  items: QuoteItem[];
}

export interface ConnectionConfigState {
  apiKey: string;
  isDemoMode: boolean;
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number; // minutes
}
