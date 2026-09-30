import {
  useRef,
  useState,
} from "react";
import type { ChangeEvent } from "react";
import "./App.css";
import { SourcePanel } from "./components/SourcePanel";
import { QuestionPanel } from "./components/QuestionPanel";
import { ProvenancePanel } from "./components/ProvenancePanel";
import type {
  CalculationResult,
  EvidenceResult,
  UploadedDocument,
  VerificationResult,
} from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://127.0.0.1:3001";


function App() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [document, setDocument] =
    useState<UploadedDocument | null>(null);

  const [uploadError, setUploadError] =
    useState("");

  const [isUploading, setIsUploading] =
    useState(false);

  const [question, setQuestion] =
    useState("");

  const [evidence, setEvidence] =
    useState<EvidenceResult[]>([]);

  const [isSearching, setIsSearching] =
    useState(false);

  const [searchError, setSearchError] = useState("");
  const [verification, setVerification] =
    useState<VerificationResult | null>(null);

  const [calculation, setCalculation] =
    useState<CalculationResult | null>(null);

  const handleChooseDocument = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const lowerName =
      file.name.toLowerCase();

    const isPdf =
      file.type === "application/pdf" ||
      lowerName.endsWith(".pdf");

    const isDocx =
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx");

    if (!isPdf && !isDocx) {
      setUploadError(
        "FinSight accepts PDF and DOCX documents.",
      );

      event.target.value = "";
      return;
    }

    setUploadError("");
    setSearchError("");
    setEvidence([]);
    setVerification(null);
    setCalculation(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("document", file);

      const response = await fetch(
        `${API_BASE_URL}/api/documents`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Document upload failed.",
        );
      }

      setDocument(data);
    } catch (error) {
      setDocument(null);

      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not upload the document.",
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleRemoveDocument = () => {
    setDocument(null);
    setQuestion("");
    setEvidence([]);
    setVerification(null);
    setCalculation(null);
    setSearchError("");
    setUploadError("");
  };

  const handleAnalyze = async () => {
    if (!document) {
      setSearchError("No document is loaded.");
      return;
    }

    if (!question.trim()) {
      setSearchError("Enter a question before analyzing.");
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setEvidence([]);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/documents/${encodeURIComponent(
          document.id,
        )}/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: question.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Evidence search failed.",
        );
      }

      setEvidence(data.results ?? []);
      const calculationResponse = await fetch(
        `${API_BASE_URL}/api/documents/${encodeURIComponent(
          document.id,
        )}/calculate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: question.trim(),
          }),
        },
      );

      const calculationData =
        await calculationResponse.json();

      if (!calculationResponse.ok) {
        throw new Error(
          calculationData.error ??
            "Calculation verification failed.",
        );
      }

      if (calculationData.status === "supported") {
        setCalculation(calculationData);
        setVerification(null);
      } else {
        setCalculation(null);

        const verificationResponse = await fetch(
          `${API_BASE_URL}/api/documents/${encodeURIComponent(
            document.id,
          )}/verify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              question: question.trim(),
            }),
          },
        );

        const verificationData =
          await verificationResponse.json();

        if (!verificationResponse.ok) {
          throw new Error(
            verificationData.error ??
              "Verification failed.",
          );
        }

        setVerification(verificationData);
      }
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "Could not retrieve evidence.",
      );
    } finally {
      setIsSearching(false);
    }
  };

return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>FinSight</h1>
          <p>Research Workbench</p>
        </div>
      </header>
      <main className="workspace">
        <SourcePanel
          document={document}
          uploadError={uploadError}
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          onChooseDocument={handleChooseDocument}
          onFileChange={handleFileChange}
          onRemoveDocument={handleRemoveDocument}
        />

        <QuestionPanel
          document={document}
          question={question}
          searchError={searchError}
          isSearching={isSearching}
          calculation={calculation}
          verification={verification}
          evidence={evidence}
          onQuestionChange={setQuestion}
          onAnalyze={handleAnalyze}
        />

        <ProvenancePanel
          calculation={calculation}
          verification={verification}
        />
      </main>
    </div>
  );
}

export default App;




















