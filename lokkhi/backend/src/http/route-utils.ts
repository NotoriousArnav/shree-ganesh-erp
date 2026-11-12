import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

export function merchantIdOf(request: FastifyRequest) {
  return request.merchantAccess!.merchantId;
}

export function parse<T>(schema: z.ZodType<T>, data: unknown, reply: FastifyReply) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    reply
      .code(400)
      .send({ error: `${path}${issue?.message ?? "Invalid request"}` });
    return null;
  }
  return result.data;
}

export function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "Not found" });
}

/** Empty text becomes null; omitted stays undefined so PATCH is not destructive. */
export const optionalText = (max = 120) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value === undefined ? undefined : value ? value : null));

export const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .nullish()
  .transform((value) => (value === undefined ? undefined : value ? value : null));

/** Server clock date in the shop's local timezone, as YYYY-MM-DD. */
export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
