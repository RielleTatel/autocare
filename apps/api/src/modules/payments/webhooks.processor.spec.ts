import { WebhooksProcessor } from "./webhooks.processor";
import { FakeProviderAdapter, FakePspPayload } from "./fake-provider.adapter";

describe("WebhooksProcessor", () => {
  const row = {
    id: "row-1",
    provider: "paymongo",
    eventId: "evt-retry-1",
    // Flat fake-shaped payload — NOT PayMongo's real nested `data.attributes...` shape. If the
    // processor bypassed the port and used the real PaymongoAdapter's parser against this, all
    // fields would come out undefined/wrong (the latent bug this test guards against).
    rawPayload: {
      eventId: "evt-retry-1", type: "payment.paid", pspReference: "pay-retry-1",
      invoiceId: "11111111-1111-1111-1111-111111111111", amountCentavos: 100000, succeeded: true,
    } satisfies FakePspPayload,
    processedAt: null as Date | null,
    attempts: 0,
    createdAt: new Date(),
  };

  function makePrisma(rows: (typeof row)[]) {
    return {
      pspWebhookEvent: {
        findMany: jest.fn().mockResolvedValue(rows),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
  }

  it("reprocesses an unprocessed row: mapEvent (via the FAKE provider port, not the concrete PayMongo adapter) parses the flat payload correctly, and processEvent is called with a well-formed PspEvent", async () => {
    const prisma = makePrisma([row]);
    const payments = { processEvent: jest.fn().mockResolvedValue(undefined) } as any;
    const provider = new FakeProviderAdapter();
    const processor = new WebhooksProcessor(prisma, payments, provider);

    await processor.process({ name: "retryUnprocessed" } as any);

    expect(prisma.pspWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: { id: "row-1", processedAt: null },
      data: { attempts: { increment: 1 } },
    });
    expect(payments.processEvent).toHaveBeenCalledTimes(1);
    const [event, webhookEventId] = payments.processEvent.mock.calls[0];
    expect(webhookEventId).toBe("row-1");
    expect(event).toEqual({
      eventId: "evt-retry-1",
      type: "payment.paid",
      pspReference: "pay-retry-1",
      invoiceId: "11111111-1111-1111-1111-111111111111",
      amountCentavos: 100000,
      succeeded: true,
      raw: row.rawPayload,
    });
  });

  it("race guard: skips a row that was claimed/processed elsewhere between the read and the claim (updateMany count 0)", async () => {
    const prisma = makePrisma([row]);
    prisma.pspWebhookEvent.updateMany.mockResolvedValue({ count: 0 });
    const payments = { processEvent: jest.fn() } as any;
    const provider = new FakeProviderAdapter();
    const processor = new WebhooksProcessor(prisma, payments, provider);

    await processor.process({ name: "retryUnprocessed" } as any);

    expect(payments.processEvent).not.toHaveBeenCalled();
  });

  it("ignores jobs that are not retryUnprocessed", async () => {
    const prisma = makePrisma([row]);
    const payments = { processEvent: jest.fn() } as any;
    const provider = new FakeProviderAdapter();
    const processor = new WebhooksProcessor(prisma, payments, provider);

    await processor.process({ name: "some.other.job" } as any);

    expect(prisma.pspWebhookEvent.findMany).not.toHaveBeenCalled();
    expect(payments.processEvent).not.toHaveBeenCalled();
  });

  it("queries only processedAt IS NULL rows for the retry pass", async () => {
    const prisma = makePrisma([]);
    const payments = { processEvent: jest.fn() } as any;
    const provider = new FakeProviderAdapter();
    const processor = new WebhooksProcessor(prisma, payments, provider);

    await processor.process({ name: "retryUnprocessed" } as any);

    expect(prisma.pspWebhookEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { processedAt: null } }),
    );
  });
});
