import { createPortal } from "react-dom";

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Yes",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger,
}) => {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-sm rounded-[24px] border border-white/[0.1] bg-v-card p-6 shadow-v-card">
        <h2 id="confirm-title" className="text-lg font-bold text-white">
          {title}
        </h2>
        {message ? <p className="mt-2 text-sm text-white/60">{message}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              danger
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-v-accent text-black hover:bg-v-accent-hover"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
