/**
 * Ratcliff/Obershelp string similarity — the same algorithm Python's
 * difflib.SequenceMatcher.ratio() uses (minus the "autojunk" heuristic,
 * which only matters for very long strings; irrelevant for brand names).
 *
 * Ported by hand rather than pulling in an npm package, so the 0.84 cutoff
 * from the original sourcing prompt carries over with the same semantics.
 */

function findLongestMatch(
  a: string,
  b: string,
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): { aStart: number; bStart: number; size: number } {
  let bestI = aStart;
  let bestJ = bStart;
  let bestSize = 0;

  for (let i = aStart; i < aEnd; i++) {
    for (let j = bStart; j < bEnd; j++) {
      let k = 0;
      while (i + k < aEnd && j + k < bEnd && a[i + k] === b[j + k]) k++;
      if (k > bestSize) {
        bestI = i;
        bestJ = j;
        bestSize = k;
      }
    }
  }

  return { aStart: bestI, bStart: bestJ, size: bestSize };
}

function totalMatchedLength(a: string, b: string): number {
  let total = 0;
  const stack: [number, number, number, number][] = [[0, a.length, 0, b.length]];

  while (stack.length > 0) {
    const [aStart, aEnd, bStart, bEnd] = stack.pop()!;
    const match = findLongestMatch(a, b, aStart, aEnd, bStart, bEnd);
    if (match.size === 0) continue;

    total += match.size;

    if (aStart < match.aStart && bStart < match.bStart) {
      stack.push([aStart, match.aStart, bStart, match.bStart]);
    }
    if (match.aStart + match.size < aEnd && match.bStart + match.size < bEnd) {
      stack.push([match.aStart + match.size, aEnd, match.bStart + match.size, bEnd]);
    }
  }

  return total;
}

/** Returns a similarity ratio in [0, 1], where 1 means identical strings. */
export function similarityRatio(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const matched = totalMatchedLength(a, b);
  return (2 * matched) / (a.length + b.length);
}
