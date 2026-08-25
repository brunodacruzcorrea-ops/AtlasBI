import { useState } from "react";
import {
  useListCartasContempladas,
  getListCartasContempladasQueryKey,
  useCreateCartaContemplada,
  useUpdateCartaContemplada,
  useDeleteCartaContemplada,
} from "@workspace/api-client-react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText,
  ShieldCheck,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
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
import { useAuth } from "@/components/auth-provider";
import { useLocation } from "wouter";

const STATUS_OPTIONS = [
  { value: "disponivel", label: "Disponível" },
  { value: "reservada", label: "Reservada" },
  { value: "vendida", label: "Vendida" },
] as const;

const statusLabel = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "vendida":
      return "bg-muted text-muted-foreground";
    case "reservada":
      return "bg-amber-500/10 text-amber-500";
    default:
      return "bg-emerald-500/10 text-emerald-500";
  }
};

const cartaContempladaSchema = z.object({
  tipoBem: z.string().min(1, "Tipo de bem obrigatório"),
  valorCredito: z.coerce
    .number()
    .min(0.01, "Valor do crédito deve ser maior que zero"),
  valorEntrada: z.coerce
    .number()
    .min(0, "Valor de entrada não pode ser negativo"),
  valorParcela: z.coerce
    .number()
    .min(0.01, "Valor de parcela deve ser maior que zero"),
  quantidadeParcelas: z.coerce
    .number()
    .int()
    .min(1, "Quantidade de parcelas deve ser ao menos 1"),
  status: z.enum(["disponivel", "reservada", "vendida"]),
  observacoes: z.string().optional(),
});

const emptyValues = {
  tipoBem: "",
  valorCredito: 0,
  valorEntrada: 0,
  valorParcela: 0,
  quantidadeParcelas: 1,
  status: "disponivel" as const,
  observacoes: "",
};

export default function CartasContempladas() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "disponivel" | "reservada" | "vendida"
  >("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: cartas, isLoading } = useListCartasContempladas(
    {},
    {
      query: {
        queryKey: getListCartasContempladasQueryKey({}),
        enabled: isAdmin,
      },
    },
  );

  const createMutation = useCreateCartaContemplada();
  const updateMutation = useUpdateCartaContemplada();
  const deleteMutation = useDeleteCartaContemplada();

  const form = useForm<z.infer<typeof cartaContempladaSchema>>({
    resolver: zodResolver(cartaContempladaSchema),
    defaultValues: emptyValues,
  });

  const filteredCartas = cartas?.filter((c) => {
    const matchesSearch = c.tipoBem
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingId(null);
    form.reset(emptyValues);
  };

  const onSubmit = (values: z.infer<typeof cartaContempladaSchema>) => {
    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListCartasContempladasQueryKey({}),
            });
            toast({ title: "Carta atualizada com sucesso" });
            handleCloseDialog();
          },
        },
      );
    } else {
      createMutation.mutate(
        { data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListCartasContempladasQueryKey({}),
            });
            toast({ title: "Carta cadastrada com sucesso" });
            handleCloseDialog();
          },
        },
      );
    }
  };

  const handleEdit = (carta: any) => {
    setEditingId(carta.id);
    form.reset({
      tipoBem: carta.tipoBem,
      valorCredito: carta.valorCredito,
      valorEntrada: carta.valorEntrada,
      valorParcela: carta.valorParcela,
      quantidadeParcelas: carta.quantidadeParcelas,
      status: carta.status,
      observacoes: carta.observacoes || "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListCartasContempladasQueryKey({}),
          });
          toast({
            title: "Carta excluída com sucesso",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-bold text-foreground">Acesso restrito</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Apenas administradores podem gerenciar cartas contempladas.
        </p>
        <Button className="mt-6" onClick={() => setLocation("/dashboard")}>
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-10">
      <div className="premium-glass rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.035em] text-foreground uppercase">
            Cartas Contempladas
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Gerencie as cartas de consórcio contempladas disponíveis
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
              Nova Carta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase">
                {editingId ? "Editar Carta" : "Cadastrar Carta"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 mt-4"
              >
                <FormField
                  control={form.control}
                  name="tipoBem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Tipo de Bem
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Veículo, Imóvel, Serviço..."
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
                    name="valorCredito"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                          Valor do Crédito
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
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
                    name="valorEntrada"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                          Valor de Entrada
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            className="bg-muted/50 focus-visible:ring-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="valorParcela"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                          Valor de Parcela
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
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
                    name="quantidadeParcelas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                          Qtd. de Parcelas
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            {...field}
                            className="bg-muted/50 focus-visible:ring-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Status
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-muted/50 focus:ring-primary">
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
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
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Observações
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalhes adicionais sobre a carta..."
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
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  >
                    {editingId ? "Salvar Alterações" : "Cadastrar Carta"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="premium-card rounded-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-card-border bg-muted/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por tipo de bem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>
          <div className="flex bg-muted p-1 rounded-lg w-full sm:w-auto">
            {(["all", "disponivel", "reservada", "vendida"] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${filterStatus === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f === "all" ? "Todas" : statusLabel(f)}
                </button>
              ),
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-accent animate-spin" />
          </div>
        ) : !filteredCartas || filteredCartas.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-foreground">
              Nenhuma carta encontrada
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ajuste os filtros ou cadastre uma nova carta contemplada.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Tipo de Bem</th>
                  <th className="px-6 py-4">Valor do Crédito</th>
                  <th className="px-6 py-4">Entrada</th>
                  <th className="px-6 py-4">Parcela</th>
                  <th className="px-6 py-4">Parcelas</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filteredCartas.map((carta, i) => (
                  <motion.tr
                    key={carta.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-foreground">
                      {carta.tipoBem}
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {formatBRL(carta.valorCredito)}
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {formatBRL(carta.valorEntrada)}
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {formatBRL(carta.valorParcela)}
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {carta.quantidadeParcelas}x
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusBadgeClass(carta.status)}`}
                      >
                        {statusLabel(carta.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(carta)}
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
                              <AlertDialogTitle>
                                Excluir carta contemplada?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação removerá permanentemente a carta de{" "}
                                {carta.tipoBem}. Não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(carta.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
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
