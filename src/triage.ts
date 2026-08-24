import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

export const SupportCategorySchema = z.enum([
  "how_to",
  "bug",
  "billing",
  "account_access",
  "feedback",
  "other",
]);

export const SupportPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);

export const KnowledgeArticleSchema = z.enum([
  "export-data",
  "change-timezone",
]);

export const TriageDecisionSchema = z.object({
  category: SupportCategorySchema,
  priority: SupportPrioritySchema,
  summary: z.string().min(1).max(240),
  knowledgeArticle: KnowledgeArticleSchema.nullable(),
});

export type TriageDecision = z.infer<typeof TriageDecisionSchema>;

export async function classifySupportEmail(input: {
  readonly from: string;
  readonly subject: string;
  readonly body: string;
}): Promise<TriageDecision> {
  const { output } = await generateText({
    model: openai("gpt-5.6"),
    output: Output.object({ schema: TriageDecisionSchema }),
    system: [
      "Classify one inbound support email.",
      "Choose a knowledgeArticle only when the email is directly answered by that article.",
      "export-data covers requesting a downloadable account export.",
      "change-timezone covers changing the timezone used in the product UI.",
      "Billing, refunds, account access, data deletion, and security reports require human review.",
      "Set billing, refunds, account access, data deletion, and security reports to high or urgent priority.",
      "Do not write a customer reply and do not decide whether a reply may be sent.",
    ].join(" "),
    prompt: `From: ${input.from}\nSubject: ${input.subject}\n\n${input.body}`,
  });

  return output;
}
