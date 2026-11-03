import test from 'node:test';
import assert from 'node:assert/strict';
import { convertUnits } from '../src/converter.mjs';

test('converts currency with default rates', () => {
  const res = convertUnits('100 usd to eur');
  assert.ok(res);
  assert.equal(res.type, 'currency');
  assert.equal(res.result, 92);
  assert.equal(res.fromLabel, '100 USD');
  assert.equal(res.toLabel, '92 EUR');

  const symbolRes = convertUnits('$50 in gbp');
  assert.ok(symbolRes);
  assert.equal(symbolRes.type, 'currency');
  assert.equal(symbolRes.result, 39);
});

test('converts currency with custom rates', () => {
  const customRates = { USD: 1.0, EUR: 0.95 };
  const res = convertUnits('100 usd to eur', customRates);
  assert.ok(res);
  assert.equal(res.result, 95);
});

test('converts length and distance', () => {
  const kmToMi = convertUnits('10 km to miles');
  assert.ok(kmToMi);
  assert.equal(kmToMi.type, 'length');
  assert.equal(kmToMi.result, 6.2137);

  const mToFt = convertUnits('100 m in ft');
  assert.ok(mToFt);
  assert.equal(mToFt.result, 328.084);

  const inToCm = convertUnits('10 inches to cm');
  assert.ok(inToCm);
  assert.equal(inToCm.result, 25.4);
});

test('converts temperature accurately', () => {
  const fToC = convertUnits('100 f to c');
  assert.ok(fToC);
  assert.equal(fToC.type, 'temperature');
  assert.equal(fToC.result, 37.7778);

  const cToF = convertUnits('37 celsius in fahrenheit');
  assert.ok(cToF);
  assert.equal(cToF.result, 98.6);

  const cToK = convertUnits('0 c to k');
  assert.ok(cToK);
  assert.equal(cToK.result, 273.15);
});

test('converts mass and weight', () => {
  const kgToLbs = convertUnits('5 kg to lbs');
  assert.ok(kgToLbs);
  assert.equal(kgToLbs.type, 'mass');
  assert.equal(kgToLbs.result, 11.0231);

  const lbsToKg = convertUnits('10 lbs in kg');
  assert.ok(lbsToKg);
  assert.equal(lbsToKg.result, 4.5359);
});

test('converts digital storage', () => {
  const gbToMb = convertUnits('1 gb to mb');
  assert.ok(gbToMb);
  assert.equal(gbToMb.type, 'digital');
  assert.equal(gbToMb.result, 1024);

  const tbToGb = convertUnits('2 tb in gb');
  assert.ok(tbToGb);
  assert.equal(tbToGb.result, 2048);
});

test('converts speed and time', () => {
  const speed = convertUnits('100 km/h in mph');
  assert.ok(speed);
  assert.equal(speed.type, 'speed');
  assert.equal(speed.result, 62.1371);

  const time = convertUnits('2.5 hours to minutes');
  assert.ok(time);
  assert.equal(time.type, 'time');
  assert.equal(time.result, 150);
});

test('converts volume and area', () => {
  const vol = convertUnits('1 gallon to liters');
  assert.ok(vol);
  assert.equal(vol.type, 'volume');
  assert.equal(vol.result, 3.7854);

  const area = convertUnits('100 sq ft to sq m');
  assert.ok(area);
  assert.equal(area.type, 'area');
  assert.equal(area.result, 9.2903);
});

test('rejects non-conversion queries safely', () => {
  assert.equal(convertUnits(''), null);
  assert.equal(convertUnits('hello world'), null);
  assert.equal(convertUnits('how to bake a cake'), null);
  assert.equal(convertUnits('100 apples to oranges'), null);
});

