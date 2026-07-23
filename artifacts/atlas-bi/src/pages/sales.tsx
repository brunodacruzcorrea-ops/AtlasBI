import { useState } from "react";
import {
  useListSales,
  getListSalesQueryKey,
  useListConsultants,
  getListConsultantsQueryKey,
  useCreateSale,
  useUpdateSale,
  useDeleteSale,
} from "@workspace/api-client-react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar as CalendarIcon,
  Filter,
  Activity,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL, formatNumber } from "@/lib/utils";

const saleSchema = z.object({
  consultantId: z.coerce.number().min(1, "Consultant is required"),
  product: z.string().min(1, "Product name is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  saleDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

export default function Sales() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [consultantFilter, setConsultantFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: consultants } = useListConsultants({
    query: { queryKey: getListConsultantsQueryKey() },
  });

  const { data: sales, isLoading } = useListSales(
    {
      month,
      year,
      consultantId:
        consultantFilter !== "all" ? Number(consultantFilter) : undefined,
    },
    {
      query: {
        queryKey: getListSalesQueryKey({
          month,
          year,
          consultantId:
            consultantFilter !== "all" ? Number(consultantFilter) : undefined,
        }),
      },
    },
  );

  const createMutation = useCreateSale();
  const updateMutation = useUpdateSale();
  const deleteMutation = useDeleteSale();

  const form = useForm<z.infer<typeof saleSchema>>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      consultantId: 0,
      product: "",
      amount: 0,
      quantity: 1,
      saleDate: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const filteredSales = sales?.filter(
    (s) =>
      s.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.consultantName &&
        s.consultantName.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const onSubmit = (values: z.infer<typeof saleSchema>) => {
    console.log("BOTÃO FUNCIONOU", values);

    const data = {
      ...values,
      saleDate: values.saleDate,
    };

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListSalesQueryKey({
                month,
                year,
                consultantId:
                  consultantFilter !== "all"
                    ? Number(consultantFilter)
                    : undefined,
              }),
            });

            queryClient.invalidateQueries({
              queryKey: ["/api/dashboard"],
            });

            toast({ title: "Sale updated successfully" });
            handleCloseDialog();
          },
        },
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListSalesQueryKey({
                month,
                year,
                consultantId:
                  consultantFilter !== "all"
                    ? Number(consultantFilter)
                    : undefined,
              }),
            });

            queryClient.invalidateQueries({
              queryKey: ["/api/dashboard"],
            });

            toast({ title: "Sale registered successfully" });
            handleCloseDialog();
          },
        },
      );
    }
  };
  const handleEdit = (sale: any) => {
    setEditingId(sale.id);
    form.reset({
      consultantId: sale.consultantId,
      product: sale.product,
      amount: sale.amount,
      quantity: sale.quantity,
      saleDate: new Date(sale.saleDate).toISOString().split("T")[0],
      notes: sale.notes || "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListSalesQueryKey({
              month,
              year,
              consultantId:
                consultantFilter !== "all"
                  ? Number(consultantFilter)
                  : undefined,
            }),
          });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          toast({ title: "Sale deleted successfully", variant: "destructive" });
        },
      },
    );
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingId(null);
    form.reset({
      consultantId: 0,
      product: "",
      amount: 0,
      quantity: 1,
      saleDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">
            Sales Ledger
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Record and track commercial production
          </p>
        </div>

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            if (!open) handleCloseDialog();
            else setIsCreateOpen(true);
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 px-6 rounded-lg gap-2 shadow-sm">
              <Plus className="w-5 h-5" />
              Register Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase">
                {editingId ? "Edit Sale" : "Register Sale"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 mt-4"
              >
                <FormField
                  control={form.control}
                  name="consultantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Consultant
                      </FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(Number(v))}
                        value={field.value ? String(field.value) : undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-muted/50 focus:ring-primary">
                            <SelectValue placeholder="Select consultant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {consultants
                            ?.filter((c) => c.active || c.id === field.value)
                            .map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="product"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Product/Service
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enterprise Plan"
                          {...field}
                          className="bg-muted/50 focus-visible:ring-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                          Amount (R$)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            className="bg-muted/50 focus-visible:ring-primary font-mono"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                          Quantity
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            className="bg-muted/50 focus-visible:ring-primary font-mono"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="saleDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Date
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className="bg-muted/50 focus-visible:ring-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Notes (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Additional details..."
                          {...field}
                          className="bg-muted/50 focus-visible:ring-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  >
                    {editingId ? "Save Changes" : "Register Sale"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm flex flex-col">
        <div className="p-4 border-b border-card-border bg-muted/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 bg-background border border-border p-1.5 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 px-2 border-r border-border">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer"
              >
                {months.map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer px-2"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 w-full sm:w-auto">
            <Select
              value={consultantFilter}
              onValueChange={setConsultantFilter}
            >
              <SelectTrigger className="w-full sm:w-48 bg-background">
                <SelectValue placeholder="All Consultants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Consultants</SelectItem>
                {consultants?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-accent animate-spin" />
          </div>
        ) : !filteredSales || filteredSales.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <Activity className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-foreground">
              No sales registered
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              No production found for the selected period.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Consultant</th>
                  <th className="px-6 py-4">Product/Service</th>
                  <th className="px-6 py-4 text-right">Qty</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filteredSales.map((sale, i) => (
                  <motion.tr
                    key={sale.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                      {new Date(sale.saleDate).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {sale.consultantName || (
                        <span className="text-muted-foreground italic">
                          Unknown
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">
                        {sale.product}
                      </div>
                      {sale.notes && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {sale.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      {sale.quantity}x
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                        {formatBRL(sale.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(sale)}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Sale?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove this sale of{" "}
                                {formatBRL(sale.amount)}? This will recalculate
                                the dashboard and rankings.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(sale.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
