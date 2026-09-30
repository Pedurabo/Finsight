import type {
  ChangeEvent,
  RefObject,
} from "react";
import type { UploadedDocument } from "../types";

type SourcePanelProps = {
  document: UploadedDocument | null;
  uploadError: string;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onChooseDocument: () => void;
  onFileChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  onRemoveDocument: () => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

export function SourcePanel({
  document,
  uploadError,
  isUploading,
  fileInputRef,
  onChooseDocument,
  onFileChange,
  onRemoveDocument,
}: SourcePanelProps) {
  return (
    <aside className="panel sources-panel">
      <h2>Sources</h2>

      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
        onChange={onFileChange}
      />

      <button
        className="primary-button"
        type="button"
        onClick={onChooseDocument}
        disabled={isUploading}
      >
        {isUploading
          ? "Uploading..."
          : document
            ? "Change document"
            : "Upload document"}
      </button>

      {uploadError && (
        <div
          className="error-message"
          role="alert"
        >
          {uploadError}
        </div>
      )}

      {document ? (
        <div className="document-card">
          <div className="document-icon">
            {document.originalName
              .toLowerCase()
              .endsWith(".docx")
              ? "DOCX"
              : "PDF"}
          </div>

          <div className="document-details">
            <strong>{document.originalName}</strong>

            <span>{formatFileSize(document.size)}</span>

            <span>Stored by FinSight</span>

            {document.extractionStatus ===
            "ocr_required" ? (
              <span className="extraction-warning">
                {document.pageCount} pages detected ·
                OCR still required
              </span>
            ) : document.extractionStatus ===
              "partial" ? (
              <span className="extraction-warning">
                {document.nonEmptyPages ?? 0} of{" "}
                {document.pageCount} pages recovered
                {document.ocrUsed ? " · OCR used" : ""}
              </span>
            ) : (
              <span className="extraction-success">
                {document.pageCount} pages extracted
                {document.ocrUsed ? " · OCR used" : ""}
              </span>
            )}
          </div>

          <button
            className="remove-button"
            type="button"
            onClick={onRemoveDocument}
          >
            Remove from workbench
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <p>No documents loaded yet.</p>
          <span>
            Upload a financial report to begin
            analysis.
          </span>
        </div>
      )}
    </aside>
  );
}
