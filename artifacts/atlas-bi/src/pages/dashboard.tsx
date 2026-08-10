import { useGetDashboardSummary, getGetDashboardSummaryQueryKey, useGetDashboardRanking, getGetDashboardRankingQueryKey, useGetProductionChart, getGetProductionChartQueryKey } from "@workspace/api-client-react";
import { formatBRL, formatNumber, formatPercent, cn } from "@/lib/utils";
import { TrendingUp, Users, Target, Activity, Medal, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { motion } from "framer-motion";
import { useState } from "react";

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );

  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ month: selectedMonth, year: selectedYear }, {
    query: { queryKey: getGetDashboardSummaryQueryKey({ month: selectedMonth, year: selectedYear }) }
  });

  const { data: ranking, isLoading: loadingRanking } = useGetDashboardRanking({ month: selectedMonth, year: selectedYear, limit: 10 }, {
    query: { queryKey: getGetDashboardRankingQueryKey({ month: selectedMonth, year: selectedYear, limit: 10 }) }
  });

  const { data: chartData, isLoading: loadingChart } = useGetProductionChart({ year: selectedYear }, {
    query: { queryKey: getGetProductionChartQueryKey({ year: selectedYear }) }
  });

  const isLoading = loadingSummary || loadingRanking || loadingChart;

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col gap-6 animate-pulse">
        <div className="h-10 w-64 bg-muted rounded-md mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl" />)}
        </div>
        <div className="h-12 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[400px] bg-muted rounded-xl" />
          <div className="h-[400px] bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (!summary || !ranking || !chartData) return null;

  const top3 = ranking.slice(0, 3);
  const restRanking = ranking.slice(3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [
    top3[1] || null,
    top3[0] || null,
    top3[2] || null
  ];
  const MONTH_NAMES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">
            Central de Comando
          </h1>
          <div className="flex gap-3 mt-4">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-lg border px-3 py-2"
            >
              {MONTH_NAMES.map((month, index) => (
                <option key={index} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border px-3 py-2"
            >
              {[2024, 2025, 2026, 2027].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground font-medium mt-1">
            Desempenho comercial em tempo real - {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}
          </p>
        </div>
      </div>

      {/* Goal Progress Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-card-border p-6 shadow-sm relative overflow-hidden"
      >
        <div className="flex justify-between items-end mb-4 relative z-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Meta Mensal</p>
            <p className="text-3xl font-black text-foreground">{formatBRL(summary.goalAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Atingido</p>
            <p className="text-3xl font-black text-accent">{formatPercent(summary.goalAchievementPercent)}</p>
          </div>
        </div>
        <div className="h-4 bg-muted rounded-full overflow-hidden relative z-10">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, summary.goalAchievementPercent)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-accent relative"
          >
            <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress_1s_linear_infinite]" />
          </motion.div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          title="Total Vendido" 
          value={formatBRL(summary.totalSales)} 
          icon={TrendingUp} 
          trend={summary.growthPercent ? `${summary.growthPercent > 0 ? '+' : ''}${summary.growthPercent.toFixed(1)}%` : undefined}
          delay={0.1}
        />
        <SummaryCard 
          title="Quantidade Vendida" 
          value={formatNumber(summary.totalQuantity)} 
          icon={Activity} 
          delay={0.2}
        />
        <SummaryCard 
          title="Consultores Ativos" 
          value={summary.activeConsultants.toString()} 
          subtitle={`de ${summary.totalConsultants} no total`}
          icon={Users} 
          delay={0.3}
        />
        <SummaryCard 
          title="Destaque do Mês" 
          value={summary.topConsultantName || "N/A"} 
          subtitle={summary.topConsultantAmount ? formatBRL(summary.topConsultantAmount) : undefined}
          icon={Trophy} 
          delay={0.4}
          highlight
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Production Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 bg-card rounded-xl border border-card-border p-6 shadow-sm"
        >
          <h2 className="text-lg font-bold uppercase tracking-wider text-foreground mb-6">Produção x Meta</h2>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis yAxisId="left" tickFormatter={(value) => `R$ ${value / 1000}k`} axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }} dx={-10} />
                <RechartsTooltip 
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--card-border))', fontWeight: 600, color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => formatBRL(value)}
                />
                <Bar yAxisId="left" dataKey="totalAmount" name="Produção" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Line yAxisId="left" type="monotone" dataKey="goalAmount" name="Meta" stroke="hsl(var(--chart-3))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Podium & Ranking */}
        <div className="flex flex-col gap-6">
          {/* Podium */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-card rounded-xl border border-card-border p-6 shadow-sm pt-8"
          >
            <h2 className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground mb-12">Top 3 Consultores</h2>
            <div className="flex items-end justify-center gap-2 h-48">
              {/* 2nd Place */}
              {podiumOrder[0] && (
                <PodiumColumn rank={2} data={podiumOrder[0]} height="h-32" color="bg-[hsl(var(--chart-5))]" delay={0.8} />
              )}
              {/* 1st Place */}
              {podiumOrder[1] && (
                <PodiumColumn rank={1} data={podiumOrder[1]} height="h-44" color="bg-[hsl(var(--chart-4))]" delay={0.7} />
              )}
              {/* 3rd Place */}
              {podiumOrder[2] && (
                <PodiumColumn rank={3} data={podiumOrder[2]} height="h-24" color="bg-[#CD7F32]" delay={0.9} />
              )}
            </div>
          </motion.div>

          {/* Rest of Ranking */}
          {restRanking.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden"
            >
              <div className="p-4 border-b border-card-border bg-muted/30">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Ranking Geral</h3>
              </div>
              <div className="divide-y border-card-border">
                {restRanking.map((entry) => (
                  <div key={entry.consultantId} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-sm font-bold text-muted-foreground">{entry.position}</span>
                      <div className="relative w-8 h-8 shrink-0 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {entry.consultantName.charAt(0).toUpperCase()}
                        {entry.photo && (
                          <img
                            src={entry.photo}
                            alt={entry.consultantName}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(event) => event.currentTarget.remove()}
                          />
                        )}
                      </div>
                      <div className="font-semibold text-sm text-foreground">{entry.consultantName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-foreground">{formatBRL(entry.totalAmount)}</div>
                      <div className="text-xs font-medium text-accent">{formatPercent((entry.goalAchievementPercent || 0))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

    function SummaryCard({ title, value, subtitle, icon: Icon, trend, highlight, delay }: any) {
      const isNegative = trend?.startsWith("-");

      return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "rounded-xl border p-6 shadow-sm relative overflow-hidden flex flex-col justify-between",
        highlight ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-card-foreground"
      )}
    >
      {highlight && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
      )}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className={cn("text-sm font-bold uppercase tracking-wider", highlight ? "text-primary-foreground/70" : "text-muted-foreground")}>{title}</h3>
        <div className={cn("p-2 rounded-lg", highlight ? "bg-white/20" : "bg-accent/10 text-accent")}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-black truncate">{value}</p>
        <div className="flex items-center gap-2 mt-1">
          {trend && (
      <span 
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isNegative
                    ? "text-red-500 bg-red-500/10"
                    : "text-emerald-500 bg-emerald-500/10"
                }`}
              >
              {trend}
            </span>
          )}
          {subtitle && (
            <span className={cn("text-sm font-medium", highlight ? "text-primary-foreground/70" : "text-muted-foreground")}>{subtitle}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PodiumColumn({ rank, data, height, color, delay }: any) {
  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "100%", opacity: 1 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-end w-full max-w-[100px] relative group"
    >
      <div className="absolute -top-16 flex flex-col items-center justify-center w-full">
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-card border-2 shadow-md flex items-center justify-center text-lg font-black z-10" style={{ borderColor: rank === 1 ? 'hsl(var(--chart-4))' : rank === 2 ? 'hsl(var(--chart-5))' : '#CD7F32' }}>
          {data.consultantName.charAt(0).toUpperCase()}
          {data.photo && (
            <img
              src={data.photo}
              alt={data.consultantName}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(event) => event.currentTarget.remove()}
            />
          )}
        </div>
        <div className="mt-2 text-center">
          <p className="text-xs font-bold text-foreground truncate w-full px-1">{data.consultantName.split(' ')[0]}</p>
          <p className="text-[10px] font-bold text-muted-foreground">{formatBRL(data.totalAmount)}</p>
        </div>
      </div>
      <div className={cn("w-full rounded-t-lg flex items-start justify-center pt-2 shadow-lg border border-b-0 border-white/20 relative overflow-hidden", height, color)}>
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
        <span className="text-2xl font-black text-white drop-shadow-md z-10">{rank}</span>
      </div>
    </motion.div>
  );
}
