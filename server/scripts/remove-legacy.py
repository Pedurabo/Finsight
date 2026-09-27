from pathlib import Path

path = Path("src/index.ts")
text = path.read_text(encoding="utf-8")

names = [
    "legacyDetectMetric",
    "legacyDetectRequestedRevenueQualifier",
    "legacyScopeDirectlyModifiesMetric",
    "legacyDetectDirectMetricScopes",
    "legacyDetectFinancialScope",
    "legacyDetectArithmeticOperation",
    "legacyExtractQuestionYears",
    "legacyComputeArithmetic",
]

def find_function_end(source: str, start: int) -> int:
    brace_start = source.find("{", start)
    if brace_start == -1:
        raise RuntimeError(
            f"No opening brace found after position {start}"
        )

    depth = 0
    i = brace_start

    in_single = False
    in_double = False
    in_template = False
    in_line_comment = False
    in_block_comment = False
    escape = False

    while i < len(source):
        ch = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if escape:
            escape = False
            i += 1
            continue

        if ch == "\\" and (
            in_single or
            in_double or
            in_template
        ):
            escape = True
            i += 1
            continue

        if not (
            in_single or
            in_double or
            in_template
        ):
            if ch == "/" and nxt == "/":
                in_line_comment = True
                i += 2
                continue

            if ch == "/" and nxt == "*":
                in_block_comment = True
                i += 2
                continue

        if not (in_double or in_template) and ch == "'":
            in_single = not in_single
            i += 1
            continue

        if not (in_single or in_template) and ch == '"':
            in_double = not in_double
            i += 1
            continue

        if not (in_single or in_double) and ch == "`":
            in_template = not in_template
            i += 1
            continue

        if in_single or in_double or in_template:
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1

            if depth == 0:
                return i + 1

        i += 1

    raise RuntimeError(
        f"Unterminated function starting at {start}"
    )


ranges = []

for name in names:
    marker = f"function {name}("
    start = text.find(marker)

    if start == -1:
        raise RuntimeError(
            f"Could not find {name}"
        )

    # Include whitespace immediately preceding the function,
    # but never cross the previous newline.
    line_start = text.rfind("\n", 0, start) + 1

    end = find_function_end(
        text,
        start,
    )

    # Consume trailing blank line where possible.
    while end < len(text) and text[end] in " \t":
        end += 1

    if end < len(text) and text[end] == "\r":
        end += 1

    if end < len(text) and text[end] == "\n":
        end += 1

    ranges.append(
        (line_start, end, name)
    )


# Remove bottom-up so offsets stay valid.
for start, end, name in sorted(
    ranges,
    reverse=True,
):
    text = (
        text[:start] +
        text[end:]
    )

path.write_text(
    text,
    encoding="utf-8",
)

print("Removed legacy functions:")

for _, _, name in ranges:
    print(f"- {name}")
