import json
import sys
import pymupdf


def clean_text(text: str) -> str:
    return " ".join(text.split())


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Expected PDF path."}))
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        document = pymupdf.open(pdf_path)
        pages = []

        for index, page in enumerate(document):
            page_number = index + 1
            embedded_text = clean_text(page.get_text())

            if len(embedded_text) > 20:
                pages.append({
                    "pageNumber": page_number,
                    "text": embedded_text,
                    "source": "embedded_text"
                })
                continue

            text_page = page.get_textpage_ocr(
                language="eng",
                dpi=200,
                full=True
            )

            ocr_text = clean_text(
                page.get_text(textpage=text_page)
            )

            pages.append({
                "pageNumber": page_number,
                "text": ocr_text,
                "source": "ocr"
            })

        print(json.dumps({
            "pageCount": len(pages),
            "pages": pages
        }))

    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
