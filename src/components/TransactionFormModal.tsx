"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import Modal from "@/components/Modal";
import { FormField, FormHint, FormInput, FormRow, FormSelect, FormTypeToggle } from "@/components/FormField";
import { formatINRFromPaise, parseINRToPaise } from "@/lib/money";
import {
  computeAllWalletBalancesInPaise,
  computeCardAvailableInPaise,
  computeCardUsedInPaise,
} from "@/lib/balances";
import {
  transactionSchema,
  TransactionFormType,
  TransactionFormValues,
} from "@/lib/transactionForm";
import { useExpenseStore } from "@/store/expenseStore";
import { useUiStore } from "@/store/uiStore";

function buildCreateValues(
  type: TransactionFormType,
  activeWallets: Array<{ id: string }>,
  wallets: Array<{ id: string }>,
  expenseCategories: Array<{ id: string }>,
  incomeCategories: Array<{ id: string }>,
  categories: Array<{ id: string }>
): TransactionFormValues {
  const todayISO = new Date().toISOString().slice(0, 10);
  const firstWallet = activeWallets[0]?.id ?? wallets[0]?.id ?? "";
  const firstExpenseCat = expenseCategories[0]?.id ?? categories[0]?.id ?? "";
  const firstIncomeCat = incomeCategories[0]?.id ?? categories[0]?.id ?? "";

  return {
    type,
    date: todayISO,
    amount: "",
    note: "",
    walletId: firstWallet,
    toWalletId: "",
    categoryId: type === "income" ? firstIncomeCat : type === "expense" ? firstExpenseCat : "",
    billId: "",
  };
}

export default function TransactionFormModal() {
  const wallets = useExpenseStore((s) => s.wallets);
  const categories = useExpenseStore((s) => s.categories);
  const transactions = useExpenseStore((s) => s.transactions);
  const upsertTransaction = useExpenseStore((s) => s.upsertTransaction);

  const open = useUiStore((s) => s.transactionModalOpen);
  const initialType = useUiStore((s) => s.transactionModalType);
  const editingId = useUiStore((s) => s.transactionEditId);
  const closeTransactionModal = useUiStore((s) => s.closeTransactionModal);

  const mode = editingId ? "edit" : "create";

  const activeWallets = useMemo(() => wallets.filter((w) => !w.archived), [wallets]);
  const incomeCategories = useMemo(() => categories.filter((c) => c.kind === "income"), [categories]);
  const expenseCategories = useMemo(() => categories.filter((c) => c.kind === "expense"), [categories]);
  const walletBalances = useMemo(
    () => computeAllWalletBalancesInPaise(wallets, transactions),
    [wallets, transactions]
  );

  const walletLabel = (walletId: string) => {
    const w = wallets.find((x) => x.id === walletId);
    if (!w) return "";
    if (w.type === "card") {
      const used = computeCardUsedInPaise(w, transactions);
      const avail = computeCardAvailableInPaise(w, transactions);
      return `${w.name} (used: ${formatINRFromPaise(used)}, avail: ${formatINRFromPaise(avail)})`;
    }
    return `${w.name} (bal: ${formatINRFromPaise(walletBalances[w.id] ?? 0)})`;
  };

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: buildCreateValues(
      "expense",
      activeWallets,
      wallets,
      expenseCategories,
      incomeCategories,
      categories
    ),
  });

  const control = form.control;
  const selectedType = useWatch({ control, name: "type" });
  const selectedWalletId = useWatch({ control, name: "walletId" });

  useEffect(() => {
    if (!open) return;

    if (editingId) {
      const tx = transactions.find((t) => t.id === editingId);
      if (!tx) return;
      form.reset({
        type: tx.type,
        date: tx.date,
        amount: String((tx.amountInPaise / 100).toFixed(2)),
        note: tx.note ?? "",
        walletId: tx.walletId,
        toWalletId: tx.toWalletId ?? "",
        categoryId: tx.categoryId ?? "",
        billId: tx.billId ?? "",
      });
      return;
    }

    form.reset(
      buildCreateValues(
        initialType,
        activeWallets,
        wallets,
        expenseCategories,
        incomeCategories,
        categories
      )
    );
  }, [
    open,
    editingId,
    initialType,
    transactions,
    activeWallets,
    wallets,
    expenseCategories,
    incomeCategories,
    categories,
    form,
  ]);

  const onSubmit = async (values: TransactionFormValues) => {
    const amountInPaise = parseINRToPaise(values.amount);

    await upsertTransaction({
      id: mode === "edit" ? editingId ?? undefined : undefined,
      type: values.type,
      date: values.date,
      amountInPaise,
      note: values.note ?? "",
      walletId: values.walletId,
      toWalletId: values.type === "transfer" ? (values.toWalletId ?? null) : null,
      categoryId:
        values.type === "transfer" ? null : values.categoryId ? values.categoryId : null,
      billId: values.billId ? values.billId : null,
    });

    closeTransactionModal();
  };

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Edit Transaction" : "Add Transaction"}
      onClose={closeTransactionModal}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={closeTransactionModal}>
            Cancel
          </button>
          <button type="submit" form="transaction_form" className="btn-primary">
            Save
          </button>
        </>
      }
    >
      <form
        id="transaction_form"
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <FormField label="Type">
          <FormTypeToggle
            value={selectedType}
            options={[
              { value: "income", label: "Income" },
              { value: "expense", label: "Expense" },
              { value: "transfer", label: "Transfer" },
            ]}
            onChange={(type) => form.setValue("type", type)}
          />
        </FormField>

        <FormRow>
          <FormField label="Date" error={form.formState.errors.date?.message}>
            <FormInput type="date" {...form.register("date")} />
          </FormField>
          <FormField label="Amount" error={form.formState.errors.amount?.message}>
            <FormInput placeholder="e.g. 1250" {...form.register("amount")} />
          </FormField>
        </FormRow>

        <FormField label="Note">
          <FormInput placeholder="Optional description" {...form.register("note")} />
        </FormField>

        {selectedType === "transfer" ? (
          <FormRow>
            <FormField label="From wallet" error={form.formState.errors.walletId?.message}>
              <FormSelect {...form.register("walletId")}>
                {activeWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {walletLabel(w.id)}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="To wallet" error={form.formState.errors.toWalletId?.message}>
              <FormSelect {...form.register("toWalletId")}>
                {activeWallets
                  .filter((w) => w.id !== selectedWalletId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </FormSelect>
            </FormField>
          </FormRow>
        ) : (
          <FormRow>
            <FormField label="Wallet" error={form.formState.errors.walletId?.message}>
              <FormSelect {...form.register("walletId")}>
                {activeWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {walletLabel(w.id)}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Category" error={form.formState.errors.categoryId?.message}>
              <FormSelect {...form.register("categoryId")}>
                {(selectedType === "income" ? incomeCategories : expenseCategories).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </FormRow>
        )}

        <FormHint>Transfers are excluded from income and expense charts.</FormHint>
      </form>
    </Modal>
  );
}
