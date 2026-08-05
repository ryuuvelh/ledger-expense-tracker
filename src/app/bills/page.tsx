"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, addMonths, addYears, format, parseISO } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import Modal from "@/components/Modal";
import IconBadge from "@/components/IconBadge";
import { FormField, FormInput, FormRow, FormSelect } from "@/components/FormField";
import { formatINRFromPaise, parseINRToPaise } from "@/lib/money";
import { useExpenseStore } from "@/store/expenseStore";
import { BillStatus } from "@/lib/types";

const billSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  amount: z.string().min(1, "Amount is required"),
  boughtDate: z.string().min(1, "Start date is required"),
  billingCycle: z.enum(["one_time", "recurring"]),
  durationValue: z.string().min(1, "Duration is required"),
  durationUnit: z.enum(["days", "months", "years"]),
  status: z.enum(["pending", "active", "paused"]),
  billType: z.enum(["phone_bill", "internet_bill", "subscription"]),
});

const paySchema = z.object({
  walletId: z.string().min(1, "Select wallet"),
  paidDate: z.string().min(1, "Date is required"),
  categoryId: z.string().min(1, "Select a category"),
});

type BillFormValues = z.infer<typeof billSchema>;
type PayFormValues = z.infer<typeof paySchema>;

const billTypeLabel: Record<BillFormValues["billType"], string> = {
  phone_bill: "Phone Bill",
  internet_bill: "Internet Bill",
  subscription: "Subscription",
};

export default function BillsPage() {
  const wallets = useExpenseStore((s) => s.wallets);
  const categories = useExpenseStore((s) => s.categories);
  const bills = useExpenseStore((s) => s.bills);
  const upsertBill = useExpenseStore((s) => s.upsertBill);
  const deleteBill = useExpenseStore((s) => s.deleteBill);
  const markBillPaid = useExpenseStore((s) => s.markBillPaid);

  const activeWallets = useMemo(() => wallets.filter((w) => !w.archived), [wallets]);
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories]
  );
  // Bill payments are expenses, so default to the "Bills" category when one exists.
  const defaultPayCategoryId = useMemo(
    () =>
      expenseCategories.find((c) => c.name.toLowerCase().includes("bill"))?.id ??
      expenseCategories[0]?.id ??
      "",
    [expenseCategories]
  );

  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);

  const form = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      title: "",
      amount: "",
      boughtDate: new Date().toISOString().slice(0, 10),
      billingCycle: "one_time",
      durationValue: "30",
      durationUnit: "days",
      status: "pending",
      billType: "subscription",
    },
  });
  const control = form.control;
  const billCycle = useWatch({ control, name: "billingCycle" });
  const durationUnit = useWatch({ control, name: "durationUnit" });
  const durationValue = useWatch({ control, name: "durationValue" });
  const startDate = useWatch({ control, name: "boughtDate" });
  const durationValueNum = Math.max(1, Number(durationValue || 0));

  const computedDate = useMemo(() => {
    if (!startDate) return "";
    const base = parseISO(startDate);
    const out =
      durationUnit === "days"
        ? addDays(base, durationValueNum)
        : durationUnit === "months"
          ? addMonths(base, durationValueNum)
          : addYears(base, durationValueNum);
    return format(out, "yyyy-MM-dd");
  }, [durationUnit, durationValueNum, startDate]);

  const payForm = useForm<PayFormValues>({
    resolver: zodResolver(paySchema),
    defaultValues: {
      walletId: activeWallets[0]?.id ?? "",
      paidDate: new Date().toISOString().slice(0, 10),
      categoryId: defaultPayCategoryId,
    },
  });

  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    form.reset({
      title: "",
      amount: "",
      boughtDate: new Date().toISOString().slice(0, 10),
      billingCycle: "one_time",
      durationValue: "30",
      durationUnit: "days",
      status: "pending",
      billType: "subscription",
    });
    setOpen(true);
  };

  const openEdit = (billId: string) => {
    const b = bills.find((x) => x.id === billId);
    if (!b) return;
    setMode("edit");
    setEditingId(billId);
    form.reset({
      id: b.id,
      title: b.title,
      amount: String((b.amountInPaise / 100).toFixed(2)),
      boughtDate: b.boughtDate,
      billingCycle: b.billingCycle,
      durationValue: String(b.durationValue),
      durationUnit: b.durationUnit,
      status: b.status,
      billType: b.billType,
    });
    setOpen(true);
  };

  const openPay = (billId: string) => {
    setPayingBillId(billId);
    payForm.reset({
      walletId: activeWallets[0]?.id ?? "",
      paidDate: new Date().toISOString().slice(0, 10),
      categoryId: defaultPayCategoryId,
    });
    setPayOpen(true);
  };

  const onSubmit = async (values: BillFormValues) => {
    const existing = mode === "edit" ? bills.find((b) => b.id === editingId) : null;
    await upsertBill({
      id: mode === "edit" ? editingId ?? undefined : undefined,
      title: values.title,
      amountInPaise: parseINRToPaise(values.amount),
      boughtDate: values.boughtDate,
      endDate: computedDate,
      lastPaidDate: existing?.lastPaidDate ?? null,
      billingCycle: values.billingCycle,
      durationValue: Math.max(1, Number(values.durationValue) || 1),
      durationUnit: values.durationUnit,
      billType: values.billType,
      status: values.status as BillStatus,
    });
    setOpen(false);
    setEditingId(null);
  };

  const onDelete = async (billId: string) => {
    const { appConfirm } = await import("@/lib/appDialog");
    const ok = await appConfirm("Delete this bill?");
    if (!ok) return;
    await deleteBill(billId);
  };

  const onPaySubmit = async (values: PayFormValues) => {
    if (!payingBillId) return;
    try {
      await markBillPaid({
        billId: payingBillId,
        walletId: values.walletId,
        paidDate: values.paidDate,
        categoryId: values.categoryId || null,
      });
      setPayOpen(false);
      setPayingBillId(null);
    } catch (error) {
      const { appAlert } = await import("@/lib/appDialog");
      const message = error instanceof Error ? error.message : "Could not record payment.";
      await appAlert(message);
    }
  };

  const sortedBills = useMemo(() => [...bills].sort((a, b) => a.endDate.localeCompare(b.endDate)), [bills]);
  const payingBill = payingBillId ? bills.find((b) => b.id === payingBillId) : null;

  return (
    <div className="space-y-8">
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Bills & Subscriptions</h1>
          <p className="page-subtitle">Store bill/subscription info. Payments enter transactions only when you click Pay.</p>
        </div>
        <button className="btn-primary w-full sm:w-auto" type="button" onClick={openCreate}>
          Add bill/subscription
        </button>
      </header>

      <section className="space-y-3 md:hidden">
        {sortedBills.length === 0 ? (
          <div className="app-card px-5 py-12 text-center text-sm text-muted-foreground">No bills yet.</div>
        ) : (
          sortedBills.map((b) => (
            <article key={b.id} className="app-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <IconBadge iconKey="expense_bills" color="#f43f5e" />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{b.title}</h3>
                    <p className="mt-1 text-xs font-mono text-muted-foreground">
                      {billTypeLabel[b.billType]} · {b.billingCycle === "one_time" ? "One-time" : "Recurring"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums text-destructive">
                    {formatINRFromPaise(b.amountInPaise)}
                  </div>
                  <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {b.status}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono text-muted-foreground">
                <div>
                  <div className="text-[10px] uppercase tracking-wider">Start</div>
                  <div className="mt-0.5 text-foreground">{format(parseISO(b.boughtDate), "dd MMM yyyy")}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider">
                    {b.billingCycle === "recurring" ? "Next due" : "End date"}
                  </div>
                  <div className="mt-0.5 text-foreground">{format(parseISO(b.endDate), "dd MMM yyyy")}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] uppercase tracking-wider">Last paid</div>
                  <div className="mt-0.5 text-foreground">
                    {b.lastPaidDate ? format(parseISO(b.lastPaidDate), "dd MMM yyyy") : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => openPay(b.id)}>
                  Pay
                </button>
                <button type="button" className="btn-ghost !p-2" aria-label="Edit bill" onClick={() => openEdit(b.id)}>
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="btn-ghost !p-2 text-rose-600"
                  aria-label="Delete bill"
                  onClick={() => void onDelete(b.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="app-card hidden overflow-x-auto md:block">
        {sortedBills.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-500">No bills yet.</div>
        ) : (
          <table className="data-table min-w-[960px]">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Type</th>
                <th>Cycle</th>
                <th>Start date</th>
                <th>End date</th>
                <th>Next due</th>
                <th>Status</th>
                <th>Last paid</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Pay</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedBills.map((b) => (
                <tr key={b.id} className="group">
                  <td>
                    <div className="flex items-center gap-2.5">
                      <IconBadge iconKey="expense_bills" color="#f43f5e" />
                      <span className="font-medium">{b.title}</span>
                    </div>
                  </td>
                  <td className="text-zinc-500">{billTypeLabel[b.billType]}</td>
                  <td className="capitalize text-zinc-500">
                    {b.billingCycle === "one_time" ? "One-time" : "Recurring"}
                  </td>
                  <td className="whitespace-nowrap text-zinc-500">{format(parseISO(b.boughtDate), "dd MMM yyyy")}</td>
                  <td className="whitespace-nowrap text-zinc-500">
                    {b.billingCycle === "one_time" ? format(parseISO(b.endDate), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="whitespace-nowrap text-zinc-500">
                    {b.billingCycle === "recurring" ? format(parseISO(b.endDate), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="capitalize text-zinc-500">{b.status}</td>
                  <td className="whitespace-nowrap text-zinc-500">
                    {b.lastPaidDate ? format(parseISO(b.lastPaidDate), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="text-right font-medium tabular-nums text-rose-700 dark:text-rose-400">
                    {formatINRFromPaise(b.amountInPaise)}
                  </td>
                  <td className="text-right">
                    <button type="button" className="btn-secondary" onClick={() => openPay(b.id)}>
                      Pay
                    </button>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="btn-ghost"
                        aria-label="Edit bill"
                        onClick={() => openEdit(b.id)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-rose-600"
                        aria-label="Delete bill"
                        onClick={() => void onDelete(b.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Modal
        open={open}
        title={mode === "edit" ? "Edit Bill" : "Add Bill"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="bill_form" className="btn-primary">
              Save
            </button>
          </>
        }
      >
        <form id="bill_form" className="space-y-4" onSubmit={form.handleSubmit((v) => void onSubmit(v))}>
          <FormRow>
            <FormField label="Cycle">
              <FormSelect {...form.register("billingCycle")}>
                <option value="one_time">One-time</option>
                <option value="recurring">Recurring</option>
              </FormSelect>
            </FormField>
            <FormField label="Status">
              <FormSelect {...form.register("status")}>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </FormSelect>
            </FormField>
          </FormRow>

          <FormField label="Title" error={form.formState.errors.title?.message}>
            <FormInput {...form.register("title")} placeholder="Bill title" />
          </FormField>

          <FormRow>
            <FormField label="Amount" error={form.formState.errors.amount?.message}>
              <FormInput {...form.register("amount")} placeholder="0.00" />
            </FormField>
            <FormField label="Bill type">
              <FormSelect {...form.register("billType")}>
                <option value="phone_bill">Phone Bill</option>
                <option value="internet_bill">Internet Bill</option>
                <option value="subscription">Subscription</option>
              </FormSelect>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Start date" error={form.formState.errors.boughtDate?.message}>
              <FormInput type="date" {...form.register("boughtDate")} />
            </FormField>
            <FormField label="Duration value" error={form.formState.errors.durationValue?.message}>
              <FormInput type="number" min="1" {...form.register("durationValue")} />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Duration unit">
              <FormSelect {...form.register("durationUnit")}>
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </FormSelect>
            </FormField>
            <div className="rounded border border-border bg-secondary/40 px-3 py-2 text-sm">
              <div className="text-xs font-mono text-muted-foreground">
                {billCycle === "recurring" ? "Next due (computed)" : "End date (computed)"}
              </div>
              <div className="mt-1 font-medium">{computedDate || "—"}</div>
            </div>
          </FormRow>
        </form>
      </Modal>

      <Modal
        open={payOpen}
        title={payingBill ? `Pay ${payingBill.title}` : "Pay bill"}
        onClose={() => setPayOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setPayOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="bill_pay_form" className="btn-primary">
              Record payment
            </button>
          </>
        }
      >
        <form id="bill_pay_form" className="space-y-4" onSubmit={payForm.handleSubmit((v) => void onPaySubmit(v))}>
          <FormField label="Wallet" error={payForm.formState.errors.walletId?.message}>
            <FormSelect {...payForm.register("walletId")}>
              {activeWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Paid date" error={payForm.formState.errors.paidDate?.message}>
            <FormInput type="date" {...payForm.register("paidDate")} />
          </FormField>
          <FormField label="Category" error={payForm.formState.errors.categoryId?.message}>
            <FormSelect {...payForm.register("categoryId")}>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FormSelect>
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

