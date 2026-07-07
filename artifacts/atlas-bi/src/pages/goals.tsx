import { useState } from "react";
import { useListGoals, getListGoalsQueryKey, useListConsultants, getListConsultantsQueryKey, useCreateGoal, useUpdateGoal, useDeleteGoal } from "@workspace/api-client-react";
import { Plus, Edit2, Trash2, Target, Calendar as CalendarIcon, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, formatNumber } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const goalSchema = z.object({
  consultantId: z.coerce.number().optional().nullable(),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000),
  targetAmount: z.coerce.number().min(0.01, "Target amount must be greater than 0"),
  targetQuantity: z.coerce.number().optional().nullable(),
  description: z.string().optional().nullable(),
});

export default function Goals() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("individual");
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: consultants } = useListConsultants({
    query: { queryKey: getListConsultantsQueryKey() }
  });

  const { data: goals, isLoading } = useListGoals(
    { month, year },
    { query: { queryKey: getListGoalsQueryKey({ month, year }) } }
  );

  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();
  const deleteMutation = useDeleteGoal();

  const form = useForm<z.infer<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      consultantId: null,
      month: currentMonth,
      year: currentYear,
      targetAmount: 0,
      targetQuantity: null,
      description: "",
    },
  });

  const individualGoals = goals?.filter(g => g.consultantId !== null) || [];
  const teamGoals = goals?.filter(g => g.consultantId === null) || [];

  const onSubmit = (values: z.infer<typeof goalSchema>) => {
    // If setting a team goal, ensure consultantId is null
    if (values.consultantId === 0 || activeTab === "team") {
      values.consultantId = null;
    }

    if (editingId) {
      updateMutation.mutate(
        {
          id: editingId,
          data: {
            targetAmount: values.targetAmount,
            targetQuantity: values.targetQuantity ?? undefined,
            description: values.description ?? undefined,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey({ month, year }) });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
            toast({ title: "Goal updated successfully" });
            handleCloseDialog();
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          data: {
            month: values.month,
            year: values.year,
            targetAmount: values.targetAmount,
            consultantId: values.consultantId ?? undefined,
            targetQuantity: values.targetQuantity ?? undefined,
            description: values.description ?? undefined,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey({ month, year }) });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
            toast({ title: "Goal set successfully" });
            handleCloseDialog();
          },
        }
      );
    }
  };

  const handleEdit = (goal: any) => {
    setEditingId(goal.id);
    setActiveTab(goal.consultantId ? "individual" : "team");
    form.reset({
      consultantId: goal.consultantId,
      month: goal.month,
      year: goal.year,
      targetAmount: goal.targetAmount,
      targetQuantity: goal.targetQuantity,
      description: goal.description || "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey({ month, year }) });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          toast({ title: "Goal deleted successfully", variant: "destructive" });
        },
      }
    );
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingId(null);
    form.reset({
      consultantId: activeTab === "individual" ? undefined : null,
      month,
      year,
      targetAmount: 0,
      targetQuantity: null,
      description: "",
    });
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Commercial Goals</h1>
          <p className="text-muted-foreground font-medium mt-1">Set targets and define expectations</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-card border border-card-border p-1.5 rounded-lg shadow-sm mr-2">
            <div className="flex items-center gap-2 px-2 border-r border-card-border">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <select 
                value={month} 
                onChange={(e) => setMonth(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer"
              >
                {months.map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <select 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer px-2"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            if (!open) handleCloseDialog();
            else {
              form.setValue("month", month);
              form.setValue("year", year);
              setIsCreateOpen(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 px-6 rounded-lg gap-2 shadow-sm">
                <Target className="w-5 h-5 text-accent" />
                Set New Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase">{editingId ? "Edit Goal" : "Set New Goal"}</DialogTitle>
              </DialogHeader>
              
              {!editingId && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="individual">Individual</TabsTrigger>
                    <TabsTrigger value="team">Team (Global)</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  {activeTab === "individual" && (
                    <FormField
                      control={form.control}
                      name="consultantId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Consultant</FormLabel>
                          <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : undefined}>
                            <FormControl>
                              <SelectTrigger className="bg-muted/50 focus:ring-primary">
                                <SelectValue placeholder="Select consultant" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {consultants?.map(c => (
                                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Month</FormLabel>
                          <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                            <FormControl>
                              <SelectTrigger className="bg-muted/50 focus:ring-primary">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {months.map((m, i) => (
                                <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Year</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="bg-muted/50 focus-visible:ring-primary font-mono" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="targetAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Target Revenue (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" {...field} className="bg-muted/50 focus-visible:ring-primary font-mono text-accent font-bold" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="targetQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Target Qty (Optional)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" value={field.value || ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} className="bg-muted/50 focus-visible:ring-primary font-mono" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Notes/Description</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g., Q3 push objective" value={field.value || ""} onChange={field.onChange} className="bg-muted/50 focus-visible:ring-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                      {editingId ? "Save Changes" : "Set Goal"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Team Goals Column */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <h2 className="text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Team Goals
          </h2>
          
          {isLoading ? (
            <div className="h-48 bg-muted animate-pulse rounded-xl" />
          ) : teamGoals.length === 0 ? (
            <div className="bg-card border border-card-border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <Target className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-bold text-muted-foreground">No team goals set for this month</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {teamGoals.map((goal, i) => (
                <motion.div 
                  key={goal.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-primary text-primary-foreground rounded-xl p-6 shadow-md relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-bold text-lg uppercase tracking-wide">Global Target</h3>
                      {goal.description && <p className="text-xs text-primary-foreground/70 mt-1">{goal.description}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(goal)} className="p-1.5 hover:bg-white/20 rounded-md transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(goal.id)} className="p-1.5 hover:bg-destructive/80 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-bold uppercase tracking-widest text-primary-foreground/50 mb-1">Revenue Goal</div>
                    <div className="text-4xl font-black text-accent drop-shadow-sm">{formatBRL(goal.targetAmount)}</div>
                  </div>
                  
                  {goal.targetQuantity && (
                    <div className="mt-4 pt-4 border-t border-primary-foreground/10 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground/50">Volume Target</span>
                      <span className="font-bold text-lg">{goal.targetQuantity} items</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Individual Goals Column */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          <h2 className="text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-accent" />
            Individual Goals
          </h2>
          
          {isLoading ? (
            <div className="h-[400px] bg-muted animate-pulse rounded-xl" />
          ) : individualGoals.length === 0 ? (
            <div className="bg-card border border-card-border border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-bold text-foreground">No individual goals</p>
              <p className="text-sm text-muted-foreground mt-1">Set specific targets for your consultants this month.</p>
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Consultant</th>
                      <th className="px-6 py-4 text-right">Revenue Target</th>
                      <th className="px-6 py-4 text-right">Volume</th>
                      <th className="px-6 py-4">Notes</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {individualGoals.map((goal, i) => (
                      <motion.tr 
                        key={goal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-foreground">
                          {goal.consultantName || `Consultant #${goal.consultantId}`}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-[hsl(var(--chart-4))] font-mono bg-[hsl(var(--chart-4))]/10 px-2 py-1 rounded">
                            {formatBRL(goal.targetAmount)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-medium text-muted-foreground">
                          {goal.targetQuantity ? `${goal.targetQuantity}x` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-muted-foreground truncate max-w-[150px] inline-block">
                            {goal.description || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(goal)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove the goal for {goal.consultantName}?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(goal.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
