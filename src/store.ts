import { Database } from "bun:sqlite"
import { z } from "zod"
import { type TriageDecision, TriageDecisionSchema } from "./triage"

const StoredDecisionRowSchema = z.object({
    decision_json: z.string(),
})

export class TriageStore {
    readonly #db: Database

    constructor(path: string) {
        this.#db = new Database(path, { create: true, strict: true })
        this.#db.run("PRAGMA journal_mode = WAL")
        this.#db.run(`
      CREATE TABLE IF NOT EXISTS triage_decision (
        event_id TEXT PRIMARY KEY,
        decision_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    }

    get(eventId: string): TriageDecision | null {
        const row = StoredDecisionRowSchema.nullable().parse(
            this.#db
                .query(
                    "SELECT decision_json FROM triage_decision WHERE event_id = ?",
                )
                .get(eventId),
        )
        if (row === null) return null
        return TriageDecisionSchema.parse(JSON.parse(row.decision_json))
    }

    put(eventId: string, decision: TriageDecision): TriageDecision {
        this.#db
            .query(
                "INSERT INTO triage_decision (event_id, decision_json) VALUES (?, ?) ON CONFLICT (event_id) DO NOTHING",
            )
            .run(eventId, JSON.stringify(decision))
        const stored = StoredDecisionRowSchema.parse(
            this.#db
                .query(
                    "SELECT decision_json FROM triage_decision WHERE event_id = ?",
                )
                .get(eventId),
        )
        return TriageDecisionSchema.parse(JSON.parse(stored.decision_json))
    }
}
