import { useState } from "react";
import { useGetDashboardRanking, getGetDashboardRankingQueryKey } from "@workspace/api-client-react";
import { formatBRL, formatPercent, cn } from "@/lib/utils";
import { Trophy, Medal, Search, Filter, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

export default function Ranking() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  const { data: ranking, isLoading: loadingCurrent } = useGetDashboardRanking(
    { month, year, limit: 100 }, 
    { query: { queryKey: getGetDashboardRankingQueryKey({ month, year, limit: 100 }) } }
  );

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const { data: previousRanking, isLoading: loadingPrevious } = useGetDashboardRanking(
    { month: previousMonth, year: previousYear, limit: 100 },
    { query: { queryKey: getGetDashboardRankingQueryKey({ month: previousMonth, year: previousYear, limit: 100 }) } }
  );
  const previousPositions = new Map(
    (previousRanking || []).map((entry) => [entry.consultantId, entry.position])
  );
  const isLoading = loadingCurrent || loadingPrevious;

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-10">
      <div className="premium-glass rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.035em] text-foreground uppercase">Ranking de Vendas</h1>
          <p className="text-muted-foreground font-medium mt-1">Desempenho geral e classificação dos consultores</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card border border-card-border p-2 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 px-3 border-r border-card-border">
            <Filter className="w-4 h-4 text-muted-foreground" />
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
            className="bg-transparent text-sm font-bold text-foreground focus:outline-none cursor-pointer px-3"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="w-full h-96 bg-muted rounded-xl animate-pulse" />
      ) : !ranking || ranking.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <Trophy className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-bold text-foreground">No ranking data</h3>
          <p className="text-muted-foreground mt-2">There is no sales data for the selected period.</p>
        </div>
      ) : (
        <div className="premium-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4 rounded-tl-xl w-24 text-center">Pos</th>
                  <th className="px-6 py-4">Consultor</th>
                  <th className="px-6 py-4 text-center">Evolução</th>
                  <th className="px-6 py-4 text-right">Total vendido</th>
                  <th className="px-6 py-4 text-center">Quantidade</th>
                  <th className="px-6 py-4 text-right rounded-tr-xl">Meta atingida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {ranking.map((entry, index) => {
                  const isFirst = entry.position === 1;
                  const isSecond = entry.position === 2;
                  const isThird = entry.position === 3;
                  const isTop3 = isFirst || isSecond || isThird;
                  const previousPosition = previousPositions.get(entry.consultantId);
                  const positionChange = previousPosition == null ? null : previousPosition - entry.position;
                  
                  return (
                    <motion.tr 
                      key={entry.consultantId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      className={cn(
                        "hover:bg-muted/30 transition-colors group",
                        isFirst ? "bg-amber-500/5 hover:bg-amber-500/10" :
                        isSecond ? "bg-slate-300/5 hover:bg-slate-300/10" :
                        isThird ? "bg-orange-700/5 hover:bg-orange-700/10" : ""
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm",
                            isFirst ? "bg-[hsl(var(--chart-4))] text-yellow-900 shadow-[0_0_10px_rgba(250,204,21,0.5)]" :
                            isSecond ? "bg-[hsl(var(--chart-5))] text-slate-800" :
                            isThird ? "bg-[#CD7F32] text-amber-900" :
                            "bg-sidebar text-sidebar-foreground"
                          )}>
                            {entry.position}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "relative w-10 h-10 shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold text-white shadow-sm",
                            isFirst ? "bg-[hsl(var(--chart-4))]" :
                            isSecond ? "bg-[hsl(var(--chart-5))]" :
                            isThird ? "bg-[#CD7F32]" :
                            "bg-primary"
                          )}>
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
                          <div>
                            <div className={cn(
                              "font-bold text-base",
                              isTop3 ? "text-foreground" : "text-foreground/90"
                            )}>
                              {entry.consultantName}
                            </div>
                            {isTop3 && (
                              <div className="text-[10px] uppercase tracking-widest font-bold mt-0.5 flex items-center gap-1"
                                style={{ 
                                  color: isFirst ? 'hsl(var(--chart-4))' : isSecond ? 'hsl(var(--chart-5))' : '#CD7F32'
                                }}
                              >
                                <Medal className="w-3 h-3" />
                                {isFirst ? "1º COLOCADO" : isSecond ? "2º COLOCADO" : "3º COLOCADO"}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {positionChange == null ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                            <Minus className="w-3.5 h-3.5" /> Novo
                          </span>
                        ) : positionChange > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600">
                            <TrendingUp className="w-4 h-4" /> +{positionChange}
                          </span>
                        ) : positionChange < 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-red-500">
                            <TrendingDown className="w-4 h-4" /> {positionChange}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                            <Minus className="w-3.5 h-3.5" /> 0
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "font-black text-lg font-mono",
                          isFirst ? "text-[hsl(var(--chart-4))]" : "text-foreground"
                        )}>
                          {formatBRL(entry.totalAmount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-muted-foreground">
                        {entry.totalQuantity} itens
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={cn(
                            "font-bold",
                            (entry.goalAchievementPercent || 0) >= 1 ? "text-emerald-500" : "text-accent"
                          )}>
                            {formatPercent(entry.goalAchievementPercent || 0)}
                          </span>
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                (entry.goalAchievementPercent || 0) >= 1 ? "bg-emerald-500" : "bg-accent"
                              )} 
                              style={{ width: `${Math.min(100, (entry.goalAchievementPercent || 0) * 100)}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

