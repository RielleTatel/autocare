import { makeSubscriptionApi } from "./subscriptionApi";

describe("makeSubscriptionApi", () => {
  it("sends a fresh Idempotency-Key header on createSubscription", async () => {
    const post = jest.fn().mockResolvedValue({ id: "s1" });
    const api: any = { post, get: jest.fn() };
    const subApi = makeSubscriptionApi(api);
    await subApi.createSubscription("v1", "p1", "COD");
    expect(post).toHaveBeenCalledWith(
      "/subscriptions",
      { vehicleId: "v1", planId: "p1", paymentMethod: "COD" },
      expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
    );
  });

  it("sends a distinct Idempotency-Key on each createPaymentIntent call", async () => {
    const post = jest.fn().mockResolvedValue({ checkoutUrl: "https://pay.example/x" });
    const api: any = { post, get: jest.fn() };
    const subApi = makeSubscriptionApi(api);
    await subApi.createPaymentIntent("inv1");
    await subApi.createPaymentIntent("inv1");
    const key1 = post.mock.calls[0][2]["Idempotency-Key"];
    const key2 = post.mock.calls[1][2]["Idempotency-Key"];
    expect(key1).toEqual(expect.any(String));
    expect(key1).not.toBe(key2);
  });

  it("calls GET /plans for listPlans", async () => {
    const get = jest.fn().mockResolvedValue([]);
    const subApi = makeSubscriptionApi({ get, post: jest.fn() } as any);
    await subApi.listPlans();
    expect(get).toHaveBeenCalledWith("/plans");
  });

  it("calls GET /invoices/:id/pdf for getInvoicePdf", async () => {
    const get = jest.fn().mockResolvedValue({ url: "https://cdn.example/x.pdf" });
    const subApi = makeSubscriptionApi({ get, post: jest.fn() } as any);
    const res = await subApi.getInvoicePdf("inv1");
    expect(get).toHaveBeenCalledWith("/invoices/inv1/pdf");
    expect(res.url).toBe("https://cdn.example/x.pdf");
  });

  it("posts acceptEtf on cancel", async () => {
    const post = jest.fn().mockResolvedValue({ id: "s1", status: "CANCELLED" });
    const subApi = makeSubscriptionApi({ get: jest.fn(), post } as any);
    await subApi.cancel("s1", true);
    expect(post).toHaveBeenCalledWith("/subscriptions/s1/cancel", { acceptEtf: true });
  });
});
