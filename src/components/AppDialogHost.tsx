"use client";

import Modal from "@/components/Modal";
import { useAppDialogStore } from "@/lib/appDialog";

export default function AppDialogHost() {
  const pending = useAppDialogStore((s) => s.pending);
  const resolvePending = useAppDialogStore((s) => s.resolvePending);

  if (!pending) return null;

  const isConfirm = pending.kind === "confirm";

  return (
    <Modal
      open
      title={pending.title}
      onClose={() => resolvePending(false)}
      footer={
        <>
          {isConfirm ? (
            <button type="button" className="btn-ghost" onClick={() => resolvePending(false)}>
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            onClick={() => resolvePending(true)}
          >
            {isConfirm ? "Continue" : "OK"}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{pending.message}</p>
    </Modal>
  );
}
