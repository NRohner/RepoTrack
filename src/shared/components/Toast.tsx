import { useAppStore } from "@/lib/store";
import { IoCheckmarkCircle, IoCloseCircle, IoInformationCircle, IoWarning, IoClose } from "react-icons/io5";

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 animate-slide-up transition-all
            ${toast.type === "success" ? "bg-green-600 text-white" : ""}
            ${toast.type === "error" ? "bg-red-600 text-white" : ""}
            ${toast.type === "info" ? "bg-accent-600 text-white" : ""}
            ${toast.type === "warning" ? "bg-amber-500 text-white" : ""}
          `}
        >
          {toast.type === "success" && <IoCheckmarkCircle className="w-4 h-4" />}
          {toast.type === "error" && <IoCloseCircle className="w-4 h-4" />}
          {toast.type === "info" && <IoInformationCircle className="w-4 h-4" />}
          {toast.type === "warning" && <IoWarning className="w-4 h-4" />}
          <span>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            <IoClose className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
