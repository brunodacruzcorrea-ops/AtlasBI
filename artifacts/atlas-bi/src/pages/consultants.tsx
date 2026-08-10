import { useState, type ChangeEvent } from "react";
import {
  useListConsultants,
  getListConsultantsQueryKey,
  useCreateConsultant,
  useUpdateConsultant,
  useDeleteConsultant,
} from "@workspace/api-client-react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  Camera,
  Upload,
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
import { Switch } from "@/components/ui/switch";
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

const consultantSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  team: z.string().min(1, "Equipe obrigatória"),
  role: z.string().min(1, "Cargo obrigatório"),
  photo: z.string().max(3_000_000, "A foto é muito grande").optional(),
  active: z.boolean().default(true),
});

export default function Consultants() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: consultants, isLoading } = useListConsultants({
    query: { queryKey: getListConsultantsQueryKey() },
  });

  const createMutation = useCreateConsultant();
  const updateMutation = useUpdateConsultant();
  const deleteMutation = useDeleteConsultant();

  const form = useForm<z.infer<typeof consultantSchema>>({
    resolver: zodResolver(consultantSchema),
    defaultValues: {
      name: "",
      email: "",
      team: "",
      role: "",
      photo: "",
      active: true,
    },
  });

  const filteredConsultants = consultants?.filter((c) => {
    const matchesSearch =
      (c.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterActive === "all"
        ? true
        : filterActive === "active"
          ? c.active
          : !c.active;
    return matchesSearch && matchesStatus;
  });

  const onSubmit = (values: z.infer<typeof consultantSchema>) => {
    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListConsultantsQueryKey(),
            });
            toast({ title: "Consultor atualizado com sucesso" });
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
              queryKey: getListConsultantsQueryKey(),
            });
            toast({ title: "Consultor cadastrado com sucesso" });
            handleCloseDialog();
          },
        },
      );
    }
  };

  const handleEdit = (consultant: any) => {
    setEditingId(consultant.id);
    form.reset({
      name: consultant.name,
      email: consultant.email,
      team: consultant.team || "",
      role: consultant.role || "",
      photo: consultant.photo || "",
      active: consultant.active,
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListConsultantsQueryKey(),
          });
          toast({
            title: "Consultor excluído com sucesso",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingId(null);

    form.reset({
      name: "",
      email: "",
      team: "",
      role: "",
      photo: "",
      active: true,
    });
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Formato de foto inválido",
        description: "Selecione uma imagem JPG, PNG ou WebP.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Foto muito grande",
        description: "A imagem deve ter no máximo 2 MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        form.setValue("photo", reader.result, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    };
    reader.onerror = () => {
      toast({
        title: "Não foi possível ler a foto",
        description: "Tente selecionar o arquivo novamente.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-10">
      <div className="premium-glass rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.035em] text-foreground uppercase">
            Consultores
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Gerencie sua equipe comercial
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
              Novo Consultor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase">
                {editingId ? "Editar Consultor" : "Cadastrar Consultor"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 mt-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Nome Completo
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        E-mail
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="john@niadcon.com.br"
                          type="email"
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
                  name="photo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Foto de perfil
                      </FormLabel>
                      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="relative w-20 h-20 shrink-0 rounded-full overflow-hidden border-2 border-primary/20 bg-sidebar-accent flex items-center justify-center text-sidebar-primary">
                            <Camera className="w-7 h-7" aria-hidden="true" />
                            {field.value && (
                              <img
                                src={field.value}
                                alt="Pré-visualização da foto do consultor"
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(event) => event.currentTarget.remove()}
                              />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <Input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handlePhotoUpload}
                              className="bg-background file:font-bold file:text-primary"
                              aria-label="Selecionar foto do consultor"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              JPG, PNG ou WebP, com no máximo 2 MB.
                            </p>
                          </div>
                        </div>
                        {field.value && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              form.setValue("photo", "", {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            className="w-full gap-2 text-destructive hover:text-destructive"
                          >
                            <XCircle className="w-4 h-4" />
                            Remover foto
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="team"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                          Equipe
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Comercial Interno"
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
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                          Cargo
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Consultor"
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
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-bold">
                          Status
                        </FormLabel>
                        <div className="text-xs text-muted-foreground">
                          Permitir acesso ao ATLAS BI
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
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
                    {editingId ? "Salvar Alterações" : "Cadastrar Consultor"}
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
              placeholder="Pesquisar consultores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>
          <div className="flex bg-muted p-1 rounded-lg w-full sm:w-auto">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterActive(f)}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${filterActive === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-accent animate-spin" />
          </div>
        ) : !filteredConsultants || filteredConsultants.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-foreground">
              No consultants found
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filters or add a Cadastrar Consultor.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Consultor</th>
                  <th className="px-6 py-4">Equipe</th>
                  <th className="px-6 py-4">Cargo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filteredConsultants.map((consultant, i) => (
                  <motion.tr
                    key={consultant.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 shrink-0 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-sidebar-primary border border-sidebar-primary/20 overflow-hidden">
                          {consultant.name?.charAt(0)?.toUpperCase() ?? "?"}
                          {consultant.photo && (
                            <img
                              src={consultant.photo}
                              alt={consultant.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(event) => event.currentTarget.remove()}
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">
                            {consultant.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {consultant.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground">
                        {consultant.team || (
                          <span className="text-muted-foreground/50 italic">
                            Não informado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {consultant.role || (
                        <span className="text-muted-foreground/50 italic">
                          Não informado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {consultant.active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground">
                          <XCircle className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(consultant)}
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
                                Delete Consultant?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove {consultant.name}.
                                This action cannot be undone. Sales history will
                                be retained but unlinked.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(consultant.id)}
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

