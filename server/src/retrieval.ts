const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "between",
  "by",
  "did",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "was",
  "were",
  "what",
  "which",
  "with",
]);
export function tokenizeSearchText(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.%$€£]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 1 &&
        !SEARCH_STOP_WORDS.has(token),
    );
}

export function buildEvidenceSnippet(
  text: string,
  queryTokens: string[],
): string {
  if (!text) {
    return "";
  }

  const lowerText = text.toLowerCase();

  let firstMatch = -1;

  for (const token of queryTokens) {
    const index = lowerText.indexOf(token);

    if (
      index !== -1 &&
      (firstMatch === -1 || index < firstMatch)
    ) {
      firstMatch = index;
    }
  }

  if (firstMatch === -1) {
    return text.slice(0, 320);
  }

  const start = Math.max(0, firstMatch - 120);
  const end = Math.min(text.length, firstMatch + 260);

  return `${start > 0 ? "..." : ""}${text.slice(
    start,
    end,
  )}${end < text.length ? "..." : ""}`;
}

export function scoreEvidencePage(
  text: string,
  question: string,
  queryTokens: string[],
): number {
  if (!text.trim() || queryTokens.length === 0) {
    return 0;
  }

  const normalizedText = text.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    const escapedToken = token.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    const matches = normalizedText.match(
      new RegExp(`\\b${escapedToken}\\b`, "g"),
    );

    const count = matches?.length ?? 0;

    if (count > 0) {
      score += 2 + Math.min(count, 5);
    }
  }

  const normalizedQuestion = question
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (
    normalizedQuestion.length > 5 &&
    normalizedText.includes(normalizedQuestion)
  ) {
    score += 10;
  }

  const matchedTokens = queryTokens.filter((token) =>
    normalizedText.includes(token),
  ).length;

  score +=
    (matchedTokens / queryTokens.length) * 5;

  return Number(score.toFixed(3));
}

