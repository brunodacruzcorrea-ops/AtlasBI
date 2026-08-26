/**
 * Regras de visibilidade de metas.
 *
 * Metas individuais (as que têm consultantId) só podem ser vistas pelo
 * consultor responsável e por admins. A meta de equipe (consultantId nulo) é
 * visível para todos.
 *
 * Puro de propósito, sem acesso a banco: é regra de permissão e precisa de
 * teste. Quem resolve o consultor do usuário logado é resolveViewer, em
 * routes/auth.ts.
 */

export type Viewer = {
  isAdmin: boolean;
  /** Consultor correspondente ao usuário logado, ou null se não houver. */
  consultantId: number | null;
};

type WithConsultant = { consultantId: number | null };

/** A meta de equipe não tem dono; qualquer um pode vê-la. */
function isTeamGoal(goal: WithConsultant): boolean {
  return goal.consultantId == null;
}

function ownsIt(viewer: Viewer, item: WithConsultant): boolean {
  return viewer.consultantId != null && item.consultantId === viewer.consultantId;
}

export function canSeeGoal(viewer: Viewer, goal: WithConsultant): boolean {
  return viewer.isAdmin || isTeamGoal(goal) || ownsIt(viewer, goal);
}

export function filterGoals<T extends WithConsultant>(viewer: Viewer, goals: T[]): T[] {
  if (viewer.isAdmin) return goals;
  return goals.filter((goal) => canSeeGoal(viewer, goal));
}

type RankingEntry = WithConsultant & {
  goalAmount: number | null;
  goalAchievementPercent: number | null;
};

/**
 * O ranking continua completo — posição, nome e total vendido de todos —, mas
 * o valor da meta e o percentual atingido só aparecem na própria linha. Sem
 * isso, esconder a meta na tela de Metas não adiantaria nada: o mesmo número
 * vazaria pelo ranking.
 */
export function maskRankingGoals<T extends RankingEntry>(viewer: Viewer, entries: T[]): T[] {
  if (viewer.isAdmin) return entries;
  return entries.map((entry) =>
    ownsIt(viewer, entry)
      ? entry
      : { ...entry, goalAmount: null, goalAchievementPercent: null },
  );
}
