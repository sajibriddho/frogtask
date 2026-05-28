/**
 * checklist-helpers.ts
 *
 * `refreshChecklistCounts` writes the aggregate {total, done} counts
 * back onto the parent Card so the kanban view can show progress without
 * needing to load every checklist.
 */

import Card from "@/model/Card";
import Checklist from "@/model/Checklist";

export async function refreshChecklistCounts(cardId: string): Promise<void> {
  const checklists = await Checklist.find({ card_id: cardId }).lean<
    Array<{ items: Array<{ is_completed: boolean }> }>
  >();
  let total = 0;
  let done = 0;
  for (const c of checklists) {
    for (const it of c.items ?? []) {
      total++;
      if (it.is_completed) done++;
    }
  }
  await Card.findByIdAndUpdate(cardId, {
    checklist_total: total,
    checklist_done: done,
    completed_at: total > 0 && done === total ? new Date() : null,
  });
}
