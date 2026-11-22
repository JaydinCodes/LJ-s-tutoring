export type FactorPair = readonly [number, number];

export function factorPairs(value: number): FactorPair[] {
  if (!Number.isSafeInteger(value) || value < 1) return [];

  const pairs: FactorPair[] = [];
  for (let factor = 1; factor * factor <= value; factor += 1) {
    if (value % factor === 0) pairs.push([factor, value / factor]);
  }
  return pairs;
}

export function primeFactors(value: number): number[] {
  if (!Number.isSafeInteger(value) || value < 2) return [];

  const factors: number[] = [];
  let remaining = value;
  for (let candidate = 2; candidate * candidate <= remaining; candidate += 1) {
    while (remaining % candidate === 0) {
      factors.push(candidate);
      remaining /= candidate;
    }
  }
  if (remaining > 1) factors.push(remaining);
  return factors;
}

export function primeFactorNotation(value: number): string {
  const factors = primeFactors(value);
  if (!factors.length) return String(value);

  return factors.reduce<Array<{ factor: number; count: number }>>((groups, factor) => {
    const previous = groups.at(-1);
    if (previous?.factor === factor) previous.count += 1;
    else groups.push({ factor, count: 1 });
    return groups;
  }, []).map(({ factor, count }) => count === 1 ? String(factor) : `${factor}${toSuperscript(count)}`).join(' × ');
}

export function highestCommonFactor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function lowestCommonMultiple(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  return Math.abs((left / highestCommonFactor(left, right)) * right);
}

export function toSuperscript(value: number): string {
  return String(value).replace(/\d/g, (digit) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)]);
}
