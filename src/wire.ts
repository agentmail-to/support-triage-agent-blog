import { z } from "zod";

export const MessageReceivedEventSchema = z.looseObject({
  type: z.literal("event"),
  event_type: z.literal("message.received"),
  event_id: z.string().min(1),
  message: z.looseObject({
    inbox_id: z.string().min(1),
    thread_id: z.string().min(1),
    message_id: z.string().min(1),
    labels: z.array(z.string()),
    timestamp: z.string().min(1),
    from: z.string().min(1),
    to: z.array(z.string()),
    subject: z.string().optional(),
    text: z.string().optional(),
    extracted_text: z.string().optional(),
  }),
});

export type MessageReceivedEvent = z.infer<typeof MessageReceivedEventSchema>;
