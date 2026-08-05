import { z } from "zod";
import { parseINRToPaise } from "@/lib/money";

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    date: z.string().min(1),
    amount: z.string().min(1),
    note: z.string().optional(),
    walletId: z.string().min(1, "Select a wallet"),
    toWalletId: z.string().optional(),
    categoryId: z.string().optional(),
    billId: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const amountPaise = parseINRToPaise(val.amount);
    if (amountPaise <= 0) {
      ctx.addIssue({ code: "custom", message: "Amount must be > 0", path: ["amount"] });
    }

    if (val.type === "transfer") {
      if (!val.toWalletId) {
        ctx.addIssue({ code: "custom", message: "Select destination wallet", path: ["toWalletId"] });
      }
      if (val.toWalletId && val.toWalletId === val.walletId) {
        ctx.addIssue({ code: "custom", message: "From/To wallet must be different", path: ["toWalletId"] });
      }
    } else if (!val.categoryId) {
      ctx.addIssue({ code: "custom", message: "Select a category", path: ["categoryId"] });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionSchema>;
export type TransactionFormType = TransactionFormValues["type"];
