import { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  CloudUpload,
  Trash2,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { invoiceApi } from "../../services/api";
import { extractError } from "../../services/apiClient";
import { cn, fileSizeMB } from "../../utils";
import { usePageTitle } from "../../hooks";

type FileStatus = "pending" | "uploading" | "success" | "error";

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  invoiceId?: string;
  error?: string;
}

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/tiff": [".tiff"],
  "image/webp": [".webp"],
};

const STEPS = [
  { n: 1, label: "Upload", desc: "PDF or image file accepted" },
  { n: 2, label: "OCR", desc: "PaddleOCR extracts raw text" },
  { n: 3, label: "Extract", desc: "Qwen LLM structures the data" },
  { n: 4, label: "Validate", desc: "Business rules are applied" },
  { n: 5, label: "Fraud Check", desc: "Duplicates and anomalies detected" },
  { n: 6, label: "Approval", desc: "Routed to the correct approver" },
];

export default function UploadPage() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  usePageTitle("Upload Invoice");

  const updateFile = (id: string, patch: Partial<QueuedFile>) => {
    setQueue((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length) {
        toast.error(
          `${rejected.length} file(s) rejected — unsupported type or too large`
        );
      }
      const newItems: QueuedFile[] = accepted.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        status: "pending",
      }));
      setQueue((prev) => [...prev, ...newItems]);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: 50 * 1024 * 1024,
    maxFiles: 20,
  });

  const uploadAll = async () => {
    const pending = queue.filter((f) => f.status === "pending");
    if (!pending.length) {
      toast.error("No files waiting to upload");
      return;
    }

    setIsUploading(true);

    for (const item of pending) {
      updateFile(item.id, { status: "uploading" });
      try {
        const invoice = await invoiceApi.upload(item.file);
        updateFile(item.id, { status: "success", invoiceId: invoice.id });
      } catch (err) {
        updateFile(item.id, { status: "error", error: extractError(err) });
      }
    }

    setIsUploading(false);
    const successCount = queue.filter(
      (f) => f.status === "success"
    ).length;
    if (successCount > 0) {
      toast.success(
        `${successCount} invoice(s) queued for processing`
      );
    }
  };

  const removeFile = (id: string) =>
    setQueue((prev) => prev.filter((f) => f.id !== id));

  const clearCompleted = () =>
    setQueue((prev) => prev.filter((f) => f.status === "pending"));

  const pendingCount = queue.filter((f) => f.status === "pending").length;

  const statusIcon = (status: FileStatus) => {
    if (status === "uploading")
      return <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />;
    if (status === "success")
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (status === "error")
      return <XCircle className="w-4 h-4 text-red-400" />;
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Upload Invoices</h1>
        <p className="text-slate-400 text-sm mt-1">
          Drop invoice PDFs or images. Processing runs automatically in the
          background.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50 bg-slate-800/20"
        )}
      >
        <input {...getInputProps()} />
        <CloudUpload
          className={cn(
            "w-14 h-14 mx-auto mb-4 transition-colors",
            isDragActive ? "text-indigo-400" : "text-slate-600"
          )}
        />
        {isDragActive ? (
          <p className="text-indigo-300 text-lg font-semibold">
            Drop files here
          </p>
        ) : (
          <>
            <p className="text-slate-200 text-lg font-semibold mb-1">
              Drop invoice files here
            </p>
            <p className="text-slate-500 text-sm">
              or click to browse from your computer
            </p>
            <p className="text-slate-600 text-xs mt-3">
              PDF, PNG, JPG, TIFF, WEBP — max 50 MB per file — up to 20 files
            </p>
          </>
        )}
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">
              {queue.length} file{queue.length !== 1 ? "s" : ""} in queue
            </p>
            <div className="flex gap-2">
              {queue.some((f) => f.status !== "pending") && (
                <button
                  onClick={clearCompleted}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Clear completed
                </button>
              )}
              <button
                onClick={() => setQueue([])}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-3"
              >
                <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm truncate font-medium">
                    {item.file.name}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {fileSizeMB(item.file.size)}
                    {item.error && (
                      <span className="text-red-400 ml-2">{item.error}</span>
                    )}
                    {item.invoiceId && (
                      <span className="text-emerald-400 ml-2">
                        ID: {item.invoiceId.slice(0, 8)}…{" "}
                        <Link
                          to={`/invoices/${item.invoiceId}`}
                          className="underline hover:text-emerald-300"
                        >
                          View
                        </Link>
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.status === "pending" && (
                    <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
                      Ready
                    </span>
                  )}
                  {statusIcon(item.status)}
                  {item.status === "pending" && (
                    <button
                      onClick={() => removeFile(item.id)}
                      className="text-slate-600 hover:text-slate-400 ml-1 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {pendingCount > 0 && (
            <button
              onClick={uploadAll}
              disabled={isUploading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload {pendingCount} Invoice
                  {pendingCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Pipeline explainer */}
      <div className="mt-8 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Info className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">
            How AI Processing Works
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STEPS.map((step) => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="w-6 h-6 bg-indigo-500/20 text-indigo-400 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                {step.n}
              </div>
              <div>
                <p className="text-slate-200 text-xs font-semibold">
                  {step.label}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
