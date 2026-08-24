# AgentMail support triage agent

Give a support agent its own AgentMail inbox. Routine questions become labeled, same-thread reply drafts; billing, account-access, and other sensitive requests wait for a person without generating a draft.

[Watch the 24-second guided run](assets/support-triage-guided-run.mp4) or read the [complete cookbook](https://github.com/maniculehq/manicule/blob/codex/agentmail-support-triage-assets/tmp/agentmail-support-triage-cookbook/post.md). The walkthrough uses a large cursor, visible click markers, and pauses on both label sets.

![Two support requests triaged in the AgentMail inbox](assets/agentmail-inbox-overview.png)

![The routine draft-ready labels and billing human-review labels shown side by side](assets/agentmail-labels-closeup.png)

## What the demo proves

- AgentMail verifies and delivers each `message.received` webhook.
- OpenAI returns a closed category, priority, summary, and optional knowledge-article key.
- Application code—not the model—decides whether a draft is allowed.
- Approved answers become same-thread drafts. Sensitive messages get a human-review label and no draft.
- SQLite stores one canonical decision per event—even when deliveries overlap. A stable AgentMail `clientId` and `triage:processed` make the remaining network retries consistent.

![A routine export question with its approved draft](assets/agentmail-draft-composer.png)

![A billing request sent to human review without a draft](assets/agentmail-billing-review.png)

## Run it

You need Bun, an AgentMail API key, an OpenAI API key, and a public HTTPS tunnel to local port 3000.

```sh
git clone https://github.com/agentmail-to/support-triage-agent-blog.git
cd support-triage-agent-blog
bun install
cp .env.example .env
```

Add `AGENTMAIL_API_KEY`, `OPENAI_API_KEY`, and your tunnel's `/webhooks` URL to `.env`. Create the inbox and webhook. The setup omits `username`, so AgentMail generates an available address and the stable `clientId` reuses it within your organization:

```sh
bun run setup:agentmail
```

Copy the generated inbox ID and webhook signing secret from `.env.agentmail.local` into `.env`, then start the receiver:

```sh
bun run dev
```

In a second terminal, run the deterministic live check:

```sh
bun run demo
```

If your AgentMail organization has no free inbox slots, set `AGENTMAIL_DEMO_SENDER_INBOX_ID` to an existing inbox you can use as the sender.

The live check sends two messages and validates these outcomes:

| Request | Labels | Draft |
| --- | --- | --- |
| Export my data | `how_to`, `normal`, `draft-ready`, `processed` | Approved same-thread reply |
| Duplicate charge | `billing`, `high`, `needs-human-review`, `processed` | None |

![Both signed webhook deliveries succeeded in AgentMail](assets/agentmail-webhook-attempts.png)

## Verify the code

```sh
bun run typecheck
bun run test
```

The test suite covers signature rejection, successful signed delivery, same-thread drafting, sensitive-message handoff, overlapping-delivery consistency, and processed-event replay.

## Safety boundary

The classifier cannot write customer-facing copy or authorize sending. It can select only one of the knowledge-article keys defined in `src/triage.ts`; `src/policy.ts` maps those keys to support-approved text and permits drafts only for low- or normal-priority how-to questions. Nothing sends automatically.

See the AgentMail guides for [webhook verification](https://docs.agentmail.to/webhook-verification), [drafts](https://docs.agentmail.to/drafts), and [idempotent requests](https://docs.agentmail.to/idempotency).
