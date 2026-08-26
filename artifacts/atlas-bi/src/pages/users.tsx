import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserCog, ShieldCheck, KeyRound } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { useLocation } from "wouter";

// Espelha os papeis aceitos pela API (artifacts/api-server/src/routes/users.ts).
// Antes este campo era texto livre e qualquer valor digitado virava admin.
const ROLES = [
  { value: "admin", label: "Administrador", hint: "Gerencia usuários e edita consultores" },
  { value: "viewer", label: "Visualizador", hint: "Somente leitura" },
] as const;

const MIN_PASSWORD_LENGTH = 6;

type AppUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  return `${base}/api${path}`;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("atlas_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchUsers(): Promise<AppUser[]> {
  const res = await fetch(apiUrl("/users"), { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ao carregar usuários (HTTP ${res.status})`);
  }
  return res.json();
}

async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<AppUser> {
  const res = await fetch(apiUrl("/users"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ao criar usuário (HTTP ${res.status})`);
  }
  return res.json();
}

async function resetPassword(id: number, password: string): Promise<void> {
  const res = await fetch(apiUrl(`/users/${id}/password`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ao redefinir senha (HTTP ${res.status})`);
  }
}

async function deleteUser(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/users/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ao remover usuário (HTTP ${res.status})`);
  }
}

const userSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`),
  role: z.enum(["admin", "viewer"], { message: "Selecione um cargo" }),
});

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery({
    queryKey: ["app-users"],
    queryFn: fetchUsers,
    enabled: isAdmin,
  });

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "", role: "viewer" },
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-users"] });
      toast({ title: "Usuário cadastrado com sucesso" });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      resetPassword(id, password),
    onSuccess: () => {
      toast({
        title: "Senha redefinida",
        description: `${resetTarget?.name} precisa entrar novamente com a nova senha.`,
      });
      closeResetDialog();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-users"] });
      toast({ title: "Usuário removido com sucesso", variant: "destructive" });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    createMutation.mutate(values);
  };

  function closeResetDialog() {
    setResetTarget(null);
    setNewPassword("");
  }

  const passwordTooShort = newPassword.length < MIN_PASSWORD_LENGTH;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-bold text-foreground">Acesso restrito</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Apenas administradores podem gerenciar usuários.
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
            Usuários
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Gerencie os acessos ao ATLAS BI
          </p>
        </div>

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) form.reset();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 px-6 rounded-lg gap-2 shadow-sm">
              <Plus className="w-5 h-5" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase">
                Cadastrar Usuário
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Nome Completo
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} className="bg-muted/50 focus-visible:ring-primary" />
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
                        <Input placeholder="nome@niadcon.com.br" type="email" {...field} className="bg-muted/50 focus-visible:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">
                        Senha
                      </FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 6 caracteres" {...field} className="bg-muted/50 focus-visible:ring-primary" />
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/50 focus:ring-primary">
                            <SelectValue placeholder="Selecione o cargo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              <span className="font-medium">{role.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {role.hint}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                    Cadastrar Usuário
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="premium-card rounded-2xl overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-accent animate-spin" />
          </div>
        ) : !users || users.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <UserCog className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-foreground">Nenhum usuário cadastrado</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Cargo</th>
                  <th className="px-6 py-4">Criado em</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-sidebar-primary border border-sidebar-primary/20">
                          {u.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground capitalize">{u.role}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Redefinir senha"
                        aria-label={`Redefinir senha de ${u.name}`}
                        onClick={() => {
                          setResetTarget(u);
                          setNewPassword("");
                        }}
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Remover usuário"
                            aria-label={`Remover ${u.name}`}
                            disabled={u.id === currentUser?.id}
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso vai remover o acesso de {u.name} ao ATLAS BI. Essa ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(u.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeResetDialog();
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase">
              Redefinir senha
            </DialogTitle>
          </DialogHeader>

          <form
            className="space-y-4 mt-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!resetTarget || passwordTooShort) return;
              resetPasswordMutation.mutate({
                id: resetTarget.id,
                password: newPassword,
              });
            }}
          >
            <p className="text-sm text-muted-foreground">
              Defina uma nova senha para{" "}
              <span className="font-bold text-foreground">{resetTarget?.name}</span>{" "}
              ({resetTarget?.email}). As sessões abertas dessa pessoa serão
              encerradas.
            </p>

            <div className="space-y-2">
              <label
                htmlFor="new-password"
                className="text-xs font-bold uppercase text-muted-foreground"
              >
                Nova senha
              </label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                className="bg-muted/50 focus-visible:ring-primary"
              />
              {newPassword.length > 0 && passwordTooShort && (
                <p className="text-xs font-medium text-destructive">
                  Mínimo de {MIN_PASSWORD_LENGTH} caracteres
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeResetDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={passwordTooShort || resetPasswordMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                {resetPasswordMutation.isPending ? "Salvando..." : "Redefinir senha"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
