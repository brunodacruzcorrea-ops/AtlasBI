import assert from "node:assert/strict";
import test from "node:test";

import { canSeeGoal, filterGoals, maskRankingGoals, type Viewer } from "./visibility";

const admin: Viewer = { isAdmin: true, consultantId: null };
const consultor: Viewer = { isAdmin: false, consultantId: 7 };
// Usuário cujo e-mail não casou com nenhum consultor.
const semVinculo: Viewer = { isAdmin: false, consultantId: null };

const metaEquipe = { id: 1, consultantId: null };
const metaPropria = { id: 2, consultantId: 7 };
const metaAlheia = { id: 3, consultantId: 9 };

test("consultor vê a meta de equipe e a própria, não a dos outros", () => {
  assert.equal(canSeeGoal(consultor, metaEquipe), true);
  assert.equal(canSeeGoal(consultor, metaPropria), true);
  assert.equal(canSeeGoal(consultor, metaAlheia), false);

  assert.deepEqual(
    filterGoals(consultor, [metaEquipe, metaPropria, metaAlheia]).map((g) => g.id),
    [1, 2],
  );
});

test("admin vê todas as metas", () => {
  assert.deepEqual(
    filterGoals(admin, [metaEquipe, metaPropria, metaAlheia]).map((g) => g.id),
    [1, 2, 3],
  );
});

test("usuário sem consultor vinculado vê só a meta de equipe", () => {
  // consultantId null não pode casar com meta de equipe por coincidência de
  // null === null: a meta de equipe passa por ser de equipe, a alheia não.
  assert.deepEqual(
    filterGoals(semVinculo, [metaEquipe, metaPropria, metaAlheia]).map((g) => g.id),
    [1],
  );
});

const ranking = [
  { consultantId: 7, goalAmount: 100000, goalAchievementPercent: 118 },
  { consultantId: 9, goalAmount: 80000, goalAchievementPercent: 42 },
];

test("ranking esconde valor e percentual da meta alheia, mantendo a própria", () => {
  const visto = maskRankingGoals(consultor, ranking);

  assert.deepEqual(visto[0], { consultantId: 7, goalAmount: 100000, goalAchievementPercent: 118 });
  assert.deepEqual(visto[1], { consultantId: 9, goalAmount: null, goalAchievementPercent: null });
});

test("ranking preserva as demais colunas ao mascarar", () => {
  const comNome = [{ consultantId: 9, consultantName: "Outro", totalAmount: 42000, goalAmount: 80000, goalAchievementPercent: 42 }];
  const [entrada] = maskRankingGoals(consultor, comNome);

  // Posição e total vendido continuam visíveis — o ranking segue sendo ranking.
  assert.equal(entrada.consultantName, "Outro");
  assert.equal(entrada.totalAmount, 42000);
  assert.equal(entrada.goalAmount, null);
});

test("admin vê o ranking sem máscara", () => {
  assert.deepEqual(maskRankingGoals(admin, ranking), ranking);
});
