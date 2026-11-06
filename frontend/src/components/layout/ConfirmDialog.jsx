import Modal from "../ui/Modal";

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Yes",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger,
  busy = false,
}) => (
  <Modal
    open={open}
    onClose={busy ? undefined : onCancel}
    title={title}
    description={message}
    size="sm"
    zIndex={100}
    dismissible={!busy}
  >
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5 disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        autoFocus
        className={`rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
          danger ? "bg-red-500 text-white hover:bg-red-600" : "bg-v-accent text-black hover:bg-v-accent-hover"
        }`}
      >
        {busy ? "Working…" : confirmLabel}
      </button>
    </div>
  </Modal>
);

export default ConfirmDialog;
