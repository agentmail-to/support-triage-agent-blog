import { z } from "zod"
import type { KnowledgeArticleSchema, TriageDecision } from "./triage"

type KnowledgeArticle = z.infer<typeof KnowledgeArticleSchema>

const KNOWLEDGE_ARTICLES = {
    "export-data": {
        category: "how_to",
        reply: "You can request an account export from Settings > Data export > Request export. We will email the download link when the file is ready.",
    },
    "change-timezone": {
        category: "how_to",
        reply: "Open Settings > Preferences, choose your timezone, and save the change. New dates in the product will use that timezone.",
    },
} satisfies Record<KnowledgeArticle, { category: "how_to"; reply: string }>

export const SupportActionSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("draft_reply"),
        text: z.string(),
        labels: z.array(z.string()),
    }),
    z.object({
        kind: z.literal("human_review"),
        labels: z.array(z.string()),
    }),
])

export type SupportAction = z.infer<typeof SupportActionSchema>

export function decideSupportAction(triage: TriageDecision): SupportAction {
    const article =
        triage.knowledgeArticle === null
            ? null
            : KNOWLEDGE_ARTICLES[triage.knowledgeArticle]
    const draftAllowed =
        article !== null &&
        article.category === triage.category &&
        (triage.priority === "low" || triage.priority === "normal")

    if (draftAllowed) {
        return {
            kind: "draft_reply",
            text: `${article.reply}\n\nA support teammate will review this draft before it is sent.`,
            labels: [
                `triage:category:${triage.category}`,
                `triage:priority:${triage.priority}`,
                "triage:draft-ready",
            ],
        } satisfies SupportAction
    }

    return {
        kind: "human_review",
        labels: [
            `triage:category:${triage.category}`,
            `triage:priority:${triage.priority}`,
            "triage:needs-human-review",
        ],
    } satisfies SupportAction
}
