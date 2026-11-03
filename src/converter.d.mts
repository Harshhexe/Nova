export type ConversionResult = {
  type: string;
  amount: number;
  result: number;
  fromLabel: string;
  toLabel: string;
  formatted: string;
};

export const DEFAULT_CURRENCY_RATES: Record<string, number>;
export function convertUnits(query: string, customRates?: Record<string, number>): ConversionResult | null;
export function fetchCurrencyRates(): Promise<Record<string, number>>;

