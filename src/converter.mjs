// Unit & Currency Conversion Engine for NOVA

export const DEFAULT_CURRENCY_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 152.0,
  CAD: 1.39,
  AUD: 1.51,
  INR: 84.1,
  CNY: 7.12,
  CHF: 0.87,
  SGD: 1.32,
  NZD: 1.67,
  KRW: 1380.0,
  SEK: 10.6,
  NOK: 10.9,
  MXN: 20.1,
  BRL: 5.75,
  AED: 3.67,
  HKD: 7.78,
  ZAR: 17.6,
  TRY: 34.3,
  BTC: 0.000014,
  ETH: 0.00038,
};

export const CURRENCY_SYMBOLS = {
  '$': 'USD',
  'usd': 'USD',
  'us dollar': 'USD',
  'us dollars': 'USD',
  'dollar': 'USD',
  'dollars': 'USD',
  '€': 'EUR',
  'eur': 'EUR',
  'euro': 'EUR',
  'euros': 'EUR',
  '£': 'GBP',
  'gbp': 'GBP',
  'pound': 'GBP',
  'pounds': 'GBP',
  '¥': 'JPY',
  'jpy': 'JPY',
  'yen': 'JPY',
  'c$': 'CAD',
  'cad': 'CAD',
  'canadian dollar': 'CAD',
  'canadian dollars': 'CAD',
  'a$': 'AUD',
  'aud': 'AUD',
  'australian dollar': 'AUD',
  'australian dollars': 'AUD',
  '₹': 'INR',
  'inr': 'INR',
  'rupee': 'INR',
  'rupees': 'INR',
  'cny': 'CNY',
  'yuan': 'CNY',
  'rmb': 'CNY',
  'chf': 'CHF',
  'franc': 'CHF',
  'swiss franc': 'CHF',
  'sgd': 'SGD',
  'singapore dollar': 'SGD',
  'nzd': 'NZD',
  '₩': 'KRW',
  'krw': 'KRW',
  'won': 'KRW',
  'sek': 'SEK',
  'krona': 'SEK',
  'nok': 'NOK',
  'mxn': 'MXN',
  'peso': 'MXN',
  'pesos': 'MXN',
  'r$': 'BRL',
  'brl': 'BRL',
  'real': 'BRL',
  'aed': 'AED',
  'dirham': 'AED',
  'hkd': 'HKD',
  'zar': 'ZAR',
  'rand': 'ZAR',
  'try': 'TRY',
  'lira': 'TRY',
  '฿': 'BTC',
  'btc': 'BTC',
  'bitcoin': 'BTC',
  'eth': 'ETH',
  'ether': 'ETH',
  'ethereum': 'ETH',
};

export const UNIT_GROUPS = {
  length: {
    base: 'm',
    units: {
      'm': { factor: 1, label: 'm' },
      'meter': { factor: 1, label: 'm' },
      'meters': { factor: 1, label: 'm' },
      'metre': { factor: 1, label: 'm' },
      'metres': { factor: 1, label: 'm' },
      'km': { factor: 1000, label: 'km' },
      'kilometer': { factor: 1000, label: 'km' },
      'kilometers': { factor: 1000, label: 'km' },
      'kilometre': { factor: 1000, label: 'km' },
      'kilometres': { factor: 1000, label: 'km' },
      'cm': { factor: 0.01, label: 'cm' },
      'centimeter': { factor: 0.01, label: 'cm' },
      'centimeters': { factor: 0.01, label: 'cm' },
      'mm': { factor: 0.001, label: 'mm' },
      'millimeter': { factor: 0.001, label: 'mm' },
      'millimeters': { factor: 0.001, label: 'mm' },
      'mi': { factor: 1609.344, label: 'mi' },
      'mile': { factor: 1609.344, label: 'mi' },
      'miles': { factor: 1609.344, label: 'mi' },
      'yd': { factor: 0.9144, label: 'yd' },
      'yard': { factor: 0.9144, label: 'yd' },
      'yards': { factor: 0.9144, label: 'yd' },
      'ft': { factor: 0.3048, label: 'ft' },
      'foot': { factor: 0.3048, label: 'ft' },
      'feet': { factor: 0.3048, label: 'ft' },
      "'": { factor: 0.3048, label: 'ft' },
      'in': { factor: 0.0254, label: 'in' },
      'inch': { factor: 0.0254, label: 'in' },
      'inches': { factor: 0.0254, label: 'in' },
      '"': { factor: 0.0254, label: 'in' },
      'nm': { factor: 1852, label: 'NM' },
      'nmi': { factor: 1852, label: 'NM' },
      'nautical mile': { factor: 1852, label: 'NM' },
      'nautical miles': { factor: 1852, label: 'NM' },
    }
  },
  mass: {
    base: 'g',
    units: {
      'g': { factor: 1, label: 'g' },
      'gram': { factor: 1, label: 'g' },
      'grams': { factor: 1, label: 'g' },
      'kg': { factor: 1000, label: 'kg' },
      'kilo': { factor: 1000, label: 'kg' },
      'kilos': { factor: 1000, label: 'kg' },
      'kilogram': { factor: 1000, label: 'kg' },
      'kilograms': { factor: 1000, label: 'kg' },
      'mg': { factor: 0.001, label: 'mg' },
      'milligram': { factor: 0.001, label: 'mg' },
      'milligrams': { factor: 0.001, label: 'mg' },
      'lb': { factor: 453.59237, label: 'lbs' },
      'lbs': { factor: 453.59237, label: 'lbs' },
      'pound': { factor: 453.59237, label: 'lbs' },
      'pounds': { factor: 453.59237, label: 'lbs' },
      'oz': { factor: 28.349523125, label: 'oz' },
      'ounce': { factor: 28.349523125, label: 'oz' },
      'ounces': { factor: 28.349523125, label: 'oz' },
      't': { factor: 1000000, label: 'tonnes' },
      'ton': { factor: 1000000, label: 'tonnes' },
      'tons': { factor: 1000000, label: 'tonnes' },
      'tonne': { factor: 1000000, label: 'tonnes' },
      'tonnes': { factor: 1000000, label: 'tonnes' },
    }
  },
  digital: {
    base: 'b',
    units: {
      'b': { factor: 1, label: 'B' },
      'byte': { factor: 1, label: 'B' },
      'bytes': { factor: 1, label: 'B' },
      'kb': { factor: 1024, label: 'KB' },
      'kilobyte': { factor: 1024, label: 'KB' },
      'kilobytes': { factor: 1024, label: 'KB' },
      'mb': { factor: 1024 * 1024, label: 'MB' },
      'megabyte': { factor: 1024 * 1024, label: 'MB' },
      'megabytes': { factor: 1024 * 1024, label: 'MB' },
      'gb': { factor: 1024 * 1024 * 1024, label: 'GB' },
      'gigabyte': { factor: 1024 * 1024 * 1024, label: 'GB' },
      'gigabytes': { factor: 1024 * 1024 * 1024, label: 'GB' },
      'tb': { factor: 1024 ** 4, label: 'TB' },
      'terabyte': { factor: 1024 ** 4, label: 'TB' },
      'terabytes': { factor: 1024 ** 4, label: 'TB' },
      'pb': { factor: 1024 ** 5, label: 'PB' },
    }
  },
  speed: {
    base: 'mps',
    units: {
      'm/s': { factor: 1, label: 'm/s' },
      'mps': { factor: 1, label: 'm/s' },
      'km/h': { factor: 1 / 3.6, label: 'km/h' },
      'kmh': { factor: 1 / 3.6, label: 'km/h' },
      'kph': { factor: 1 / 3.6, label: 'km/h' },
      'mph': { factor: 0.44704, label: 'mph' },
      'knot': { factor: 0.514444, label: 'knots' },
      'knots': { factor: 0.514444, label: 'knots' },
      'fps': { factor: 0.3048, label: 'ft/s' },
      'ft/s': { factor: 0.3048, label: 'ft/s' },
    }
  },
  time: {
    base: 's',
    units: {
      'ms': { factor: 0.001, label: 'ms' },
      'millisecond': { factor: 0.001, label: 'ms' },
      'milliseconds': { factor: 0.001, label: 'ms' },
      's': { factor: 1, label: 'sec' },
      'sec': { factor: 1, label: 'sec' },
      'secs': { factor: 1, label: 'sec' },
      'second': { factor: 1, label: 'sec' },
      'seconds': { factor: 1, label: 'sec' },
      'min': { factor: 60, label: 'min' },
      'mins': { factor: 60, label: 'min' },
      'minute': { factor: 60, label: 'min' },
      'minutes': { factor: 60, label: 'min' },
      'h': { factor: 3600, label: 'hrs' },
      'hr': { factor: 3600, label: 'hrs' },
      'hrs': { factor: 3600, label: 'hrs' },
      'hour': { factor: 3600, label: 'hrs' },
      'hours': { factor: 3600, label: 'hrs' },
      'd': { factor: 86400, label: 'days' },
      'day': { factor: 86400, label: 'days' },
      'days': { factor: 86400, label: 'days' },
      'wk': { factor: 604800, label: 'weeks' },
      'wks': { factor: 604800, label: 'weeks' },
      'week': { factor: 604800, label: 'weeks' },
      'weeks': { factor: 604800, label: 'weeks' },
      'mo': { factor: 2629800, label: 'months' },
      'month': { factor: 2629800, label: 'months' },
      'months': { factor: 2629800, label: 'months' },
      'yr': { factor: 31557600, label: 'years' },
      'yrs': { factor: 31557600, label: 'years' },
      'year': { factor: 31557600, label: 'years' },
      'years': { factor: 31557600, label: 'years' },
    }
  },
  volume: {
    base: 'ml',
    units: {
      'ml': { factor: 1, label: 'ml' },
      'milliliter': { factor: 1, label: 'ml' },
      'milliliters': { factor: 1, label: 'ml' },
      'l': { factor: 1000, label: 'L' },
      'liter': { factor: 1000, label: 'L' },
      'liters': { factor: 1000, label: 'L' },
      'litre': { factor: 1000, label: 'L' },
      'litres': { factor: 1000, label: 'L' },
      'tsp': { factor: 4.92892, label: 'tsp' },
      'teaspoon': { factor: 4.92892, label: 'tsp' },
      'teaspoons': { factor: 4.92892, label: 'tsp' },
      'tbsp': { factor: 14.7868, label: 'tbsp' },
      'tablespoon': { factor: 14.7868, label: 'tbsp' },
      'tablespoons': { factor: 14.7868, label: 'tbsp' },
      'fl oz': { factor: 29.5735, label: 'fl oz' },
      'floz': { factor: 29.5735, label: 'fl oz' },
      'fluid ounce': { factor: 29.5735, label: 'fl oz' },
      'fluid ounces': { factor: 29.5735, label: 'fl oz' },
      'cup': { factor: 236.588, label: 'cups' },
      'cups': { factor: 236.588, label: 'cups' },
      'pt': { factor: 473.176, label: 'pints' },
      'pint': { factor: 473.176, label: 'pints' },
      'pints': { factor: 473.176, label: 'pints' },
      'qt': { factor: 946.353, label: 'quarts' },
      'quart': { factor: 946.353, label: 'quarts' },
      'quarts': { factor: 946.353, label: 'quarts' },
      'gal': { factor: 3785.41, label: 'gal' },
      'gallon': { factor: 3785.41, label: 'gal' },
      'gallons': { factor: 3785.41, label: 'gal' },
    }
  },
  area: {
    base: 'sqm',
    units: {
      'sq m': { factor: 1, label: 'm²' },
      'sqm': { factor: 1, label: 'm²' },
      'm2': { factor: 1, label: 'm²' },
      'm^2': { factor: 1, label: 'm²' },
      'sq km': { factor: 1000000, label: 'km²' },
      'sqkm': { factor: 1000000, label: 'km²' },
      'km2': { factor: 1000000, label: 'km²' },
      'km^2': { factor: 1000000, label: 'km²' },
      'sq ft': { factor: 0.092903, label: 'sq ft' },
      'sqft': { factor: 0.092903, label: 'sq ft' },
      'ft2': { factor: 0.092903, label: 'sq ft' },
      'ft^2': { factor: 0.092903, label: 'sq ft' },
      'square feet': { factor: 0.092903, label: 'sq ft' },
      'square foot': { factor: 0.092903, label: 'sq ft' },
      'sq in': { factor: 0.00064516, label: 'sq in' },
      'sqin': { factor: 0.00064516, label: 'sq in' },
      'in2': { factor: 0.00064516, label: 'sq in' },
      'in^2': { factor: 0.00064516, label: 'sq in' },
      'sq yd': { factor: 0.836127, label: 'sq yd' },
      'acre': { factor: 4046.86, label: 'acres' },
      'acres': { factor: 4046.86, label: 'acres' },
      'ha': { factor: 10000, label: 'ha' },
      'hectare': { factor: 10000, label: 'ha' },
      'hectares': { factor: 10000, label: 'ha' },
    }
  }
};

export const TEMP_UNITS = {
  'c': 'C',
  '°c': 'C',
  'celsius': 'C',
  'centigrade': 'C',
  'f': 'F',
  '°f': 'F',
  'fahrenheit': 'F',
  'k': 'K',
  'kelvin': 'K',
};

function formatResultNumber(n) {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1e7 || (Math.abs(n) > 0 && Math.abs(n) < 1e-4)) {
    return Number(n.toPrecision(5)).toString();
  }
  const rounded = Number(n.toFixed(4));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function convertUnits(query, customRates = {}) {
  const str = query.trim().replace(/\s+/g, ' ');
  if (!str) return null;

  let amount, fromUnitRaw, toUnitRaw;
  const prefixMatch = str.match(/^([$€£¥₹₩฿]|c\$|a\$|r\$)\s*([+-]?\d+(?:\.\d+)?)\s*(?:to|in|=|->|as)\s+([\s\S]+)$/i);
  if (prefixMatch) {
    fromUnitRaw = prefixMatch[1].toLowerCase();
    amount = parseFloat(prefixMatch[2]);
    toUnitRaw = prefixMatch[3].trim().toLowerCase();
  } else {
    const standardMatch = str.match(/^([+-]?\d+(?:\.\d+)?)\s*([\s\S]*?)\s*(?:to|in|=|->|as)\s+([\s\S]+)$/i);
    if (!standardMatch) return null;
    amount = parseFloat(standardMatch[1]);
    fromUnitRaw = (standardMatch[2] || '').trim().toLowerCase();
    toUnitRaw = standardMatch[3].trim().toLowerCase();
  }

  if (!fromUnitRaw || !toUnitRaw || isNaN(amount)) return null;

  // Temperature conversions
  const fromTemp = TEMP_UNITS[fromUnitRaw];
  const toTemp = TEMP_UNITS[toUnitRaw];
  if (fromTemp && toTemp) {
    let kelvin;
    if (fromTemp === 'C') kelvin = amount + 273.15;
    else if (fromTemp === 'F') kelvin = (amount - 32) * (5 / 9) + 273.15;
    else kelvin = amount;

    let targetVal;
    if (toTemp === 'C') targetVal = kelvin - 273.15;
    else if (toTemp === 'F') targetVal = (kelvin - 273.15) * (9 / 5) + 32;
    else targetVal = kelvin;

    const fromLabel = `${amount}°${fromTemp}`;
    const toLabel = `${formatResultNumber(targetVal)}°${toTemp}`;
    return {
      type: 'temperature',
      amount,
      result: Number(targetVal.toFixed(4)),
      fromLabel,
      toLabel,
      formatted: `${fromLabel} = ${toLabel}`,
    };
  }

  // Currency conversions
  const fromCurr = CURRENCY_SYMBOLS[fromUnitRaw];
  const toCurr = CURRENCY_SYMBOLS[toUnitRaw];
  if (fromCurr && toCurr) {
    const rates = { ...DEFAULT_CURRENCY_RATES, ...customRates };
    const rateFrom = rates[fromCurr];
    const rateTo = rates[toCurr];
    if (rateFrom && rateTo) {
      const targetVal = (amount / rateFrom) * rateTo;
      const fromLabel = `${formatResultNumber(amount)} ${fromCurr}`;
      const toLabel = `${formatResultNumber(targetVal)} ${toCurr}`;
      return {
        type: 'currency',
        amount,
        result: Number(targetVal.toFixed(4)),
        fromLabel,
        toLabel,
        formatted: `${fromLabel} = ${toLabel}`,
      };
    }
  }

  // Unit Groups
  for (const [groupName, group] of Object.entries(UNIT_GROUPS)) {
    const uFrom = group.units[fromUnitRaw];
    const uTo = group.units[toUnitRaw];
    if (uFrom && uTo) {
      const baseVal = amount * uFrom.factor;
      const targetVal = baseVal / uTo.factor;
      const fromLabel = `${formatResultNumber(amount)} ${uFrom.label}`;
      const toLabel = `${formatResultNumber(targetVal)} ${uTo.label}`;
      return {
        type: groupName,
        amount,
        result: Number(targetVal.toFixed(4)),
        fromLabel,
        toLabel,
        formatted: `${fromLabel} = ${toLabel}`,
      };
    }
  }

  return null;
}

export async function fetchCurrencyRates() {
  const CACHE_KEY = 'nova-currency-rates';
  const CACHE_TIME_KEY = 'nova-currency-rates-ts';
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTs = localStorage.getItem(CACHE_TIME_KEY);
    if (cached && cachedTs && Date.now() - Number(cachedTs) < TWELVE_HOURS) {
      return JSON.parse(cached);
    }
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw Error('Network response not ok');
    const data = await res.json();
    if (data?.rates && typeof data.rates === 'object') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data.rates));
      localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
      return data.rates;
    }
  } catch {
    // Return cached if available even if older than 12h
    try {
      const fallback = localStorage.getItem(CACHE_KEY);
      if (fallback) return JSON.parse(fallback);
    } catch {}
  }
  return DEFAULT_CURRENCY_RATES;
}

