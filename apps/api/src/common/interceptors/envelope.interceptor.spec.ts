import { Reflector } from "@nestjs/core";
import { of, lastValueFrom } from "rxjs";
import { EnvelopeInterceptor } from "./envelope.interceptor";
import { RAW_RESPONSE } from "./raw-response.decorator";

function ctx(handler: object = () => undefined) {
  return { getHandler: () => handler, getClass: () => class {} } as never;
}

const next = (data: unknown) => ({ handle: () => of(data) });

describe("EnvelopeInterceptor", () => {
  it("wraps ordinary handler results in the success envelope", async () => {
    const interceptor = new EnvelopeInterceptor(new Reflector());
    const out = await lastValueFrom(interceptor.intercept(ctx(), next({ id: "v1" })));
    expect(out).toEqual({ success: true, data: { id: "v1" }, meta: null, error: null });
  });

  it("leaves a raw-response handler untouched, so a CSV stays a CSV", async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    const interceptor = new EnvelopeInterceptor(reflector);
    const csv = "disposed_at,work_order\n2026-08-20,WO-1";
    const out = await lastValueFrom(interceptor.intercept(ctx(), next(csv)));
    expect(out).toBe(csv);
  });

  it("exports the metadata key the decorator sets", () => {
    expect(RAW_RESPONSE).toBe("raw_response");
  });
});
