import {
  nextState,
  InvoiceState,
  InvoiceEvent,
  RETRY_DAYS,
  subscriptionStatusFor,
  SubscriptionStatusValue,
} from "./invoice-lifecycle";

describe("invoice-lifecycle", () => {
  describe("nextState", () => {
    describe("exhaustive (state, event) table", () => {
      const states: InvoiceState[] = [
        "INVOICE_ISSUED",
        "AWAITING_AUTO_CHARGE",
        "RETRYING",
        "AWAITING_CASH",
        "GRACE",
        "PAST_DUE",
        "SUSPENDED",
        "PAID",
      ];

      it("every state handles all event types without error", () => {
        const events: InvoiceEvent[] = [
          { type: "ISSUED", method: "E_PAYMENT" },
          { type: "ISSUED", method: "COD" },
          { type: "CHARGE_SUCCEEDED" },
          { type: "CHARGE_FAILED", attempt: 1 },
          { type: "CHARGE_FAILED", attempt: 2 },
          { type: "CHARGE_FAILED", attempt: 3 },
          { type: "CASH_RECORDED" },
          { type: "DAY_ELAPSED", daysSinceDue: 0 },
          { type: "DAY_ELAPSED", daysSinceDue: 1 },
          { type: "DAY_ELAPSED", daysSinceDue: 8 },
          { type: "DAY_ELAPSED", daysSinceDue: 15 },
        ];

        states.forEach((state) => {
          events.forEach((event) => {
            expect(() => nextState(state, event)).not.toThrow();
            const result = nextState(state, event);
            expect(states).toContain(result);
          });
        });
      });

      it("INVOICE_ISSUED transitions correctly", () => {
        expect(
          nextState("INVOICE_ISSUED", { type: "ISSUED", method: "E_PAYMENT" })
        ).toBe("AWAITING_AUTO_CHARGE");
        expect(
          nextState("INVOICE_ISSUED", { type: "ISSUED", method: "COD" })
        ).toBe("AWAITING_CASH");
        expect(
          nextState("INVOICE_ISSUED", { type: "CHARGE_SUCCEEDED" })
        ).toBe("INVOICE_ISSUED");
        expect(
          nextState("INVOICE_ISSUED", { type: "CHARGE_FAILED", attempt: 1 })
        ).toBe("INVOICE_ISSUED");
        expect(
          nextState("INVOICE_ISSUED", { type: "CASH_RECORDED" })
        ).toBe("INVOICE_ISSUED");
        expect(
          nextState("INVOICE_ISSUED", { type: "DAY_ELAPSED", daysSinceDue: 1 })
        ).toBe("INVOICE_ISSUED");
      });

      it("AWAITING_AUTO_CHARGE transitions correctly", () => {
        expect(
          nextState("AWAITING_AUTO_CHARGE", { type: "CHARGE_SUCCEEDED" })
        ).toBe("PAID");
        expect(
          nextState("AWAITING_AUTO_CHARGE", {
            type: "CHARGE_FAILED",
            attempt: 1,
          })
        ).toBe("RETRYING");
        expect(
          nextState("AWAITING_AUTO_CHARGE", {
            type: "ISSUED",
            method: "E_PAYMENT",
          })
        ).toBe("AWAITING_AUTO_CHARGE");
        expect(
          nextState("AWAITING_AUTO_CHARGE", { type: "CASH_RECORDED" })
        ).toBe("AWAITING_AUTO_CHARGE");
        expect(
          nextState("AWAITING_AUTO_CHARGE", {
            type: "DAY_ELAPSED",
            daysSinceDue: 1,
          })
        ).toBe("AWAITING_AUTO_CHARGE");
      });

      it("RETRYING transitions correctly", () => {
        expect(
          nextState("RETRYING", { type: "CHARGE_SUCCEEDED" })
        ).toBe("PAID");
        expect(
          nextState("RETRYING", { type: "CHARGE_FAILED", attempt: 1 })
        ).toBe("RETRYING");
        expect(
          nextState("RETRYING", { type: "CHARGE_FAILED", attempt: 2 })
        ).toBe("RETRYING");
        expect(
          nextState("RETRYING", { type: "CHARGE_FAILED", attempt: 3 })
        ).toBe("PAST_DUE");
        expect(
          nextState("RETRYING", { type: "ISSUED", method: "E_PAYMENT" })
        ).toBe("RETRYING");
        expect(
          nextState("RETRYING", { type: "CASH_RECORDED" })
        ).toBe("RETRYING");
        expect(
          nextState("RETRYING", { type: "DAY_ELAPSED", daysSinceDue: 1 })
        ).toBe("RETRYING");
      });

      it("AWAITING_CASH transitions correctly", () => {
        expect(
          nextState("AWAITING_CASH", { type: "CASH_RECORDED" })
        ).toBe("PAID");
        expect(
          nextState("AWAITING_CASH", { type: "DAY_ELAPSED", daysSinceDue: 0 })
        ).toBe("AWAITING_CASH");
        expect(
          nextState("AWAITING_CASH", { type: "DAY_ELAPSED", daysSinceDue: 1 })
        ).toBe("GRACE");
        expect(
          nextState("AWAITING_CASH", { type: "CHARGE_SUCCEEDED" })
        ).toBe("AWAITING_CASH");
        expect(
          nextState("AWAITING_CASH", { type: "ISSUED", method: "COD" })
        ).toBe("AWAITING_CASH");
      });

      it("GRACE transitions correctly", () => {
        expect(nextState("GRACE", { type: "CASH_RECORDED" })).toBe("PAID");
        expect(
          nextState("GRACE", { type: "CHARGE_SUCCEEDED" })
        ).toBe("PAID");
        expect(
          nextState("GRACE", { type: "DAY_ELAPSED", daysSinceDue: 7 })
        ).toBe("GRACE");
        expect(
          nextState("GRACE", { type: "DAY_ELAPSED", daysSinceDue: 8 })
        ).toBe("PAST_DUE");
        expect(
          nextState("GRACE", { type: "CHARGE_FAILED", attempt: 1 })
        ).toBe("GRACE");
        expect(
          nextState("GRACE", { type: "ISSUED", method: "E_PAYMENT" })
        ).toBe("GRACE");
      });

      it("PAST_DUE transitions correctly", () => {
        expect(
          nextState("PAST_DUE", { type: "CASH_RECORDED" })
        ).toBe("PAID");
        expect(
          nextState("PAST_DUE", { type: "CHARGE_SUCCEEDED" })
        ).toBe("PAID");
        expect(
          nextState("PAST_DUE", { type: "DAY_ELAPSED", daysSinceDue: 14 })
        ).toBe("PAST_DUE");
        expect(
          nextState("PAST_DUE", { type: "DAY_ELAPSED", daysSinceDue: 15 })
        ).toBe("SUSPENDED");
        expect(
          nextState("PAST_DUE", { type: "CHARGE_FAILED", attempt: 1 })
        ).toBe("PAST_DUE");
        expect(
          nextState("PAST_DUE", { type: "ISSUED", method: "E_PAYMENT" })
        ).toBe("PAST_DUE");
      });

      it("SUSPENDED transitions correctly", () => {
        expect(
          nextState("SUSPENDED", { type: "CASH_RECORDED" })
        ).toBe("PAID");
        expect(
          nextState("SUSPENDED", { type: "CHARGE_SUCCEEDED" })
        ).toBe("PAID");
        expect(
          nextState("SUSPENDED", { type: "DAY_ELAPSED", daysSinceDue: 20 })
        ).toBe("SUSPENDED");
        expect(
          nextState("SUSPENDED", { type: "CHARGE_FAILED", attempt: 1 })
        ).toBe("SUSPENDED");
        expect(
          nextState("SUSPENDED", { type: "ISSUED", method: "E_PAYMENT" })
        ).toBe("SUSPENDED");
      });

      it("PAID is terminal", () => {
        expect(nextState("PAID", { type: "ISSUED", method: "E_PAYMENT" })).toBe(
          "PAID"
        );
        expect(nextState("PAID", { type: "CHARGE_SUCCEEDED" })).toBe("PAID");
        expect(
          nextState("PAID", { type: "CHARGE_FAILED", attempt: 1 })
        ).toBe("PAID");
        expect(nextState("PAID", { type: "CASH_RECORDED" })).toBe("PAID");
        expect(
          nextState("PAID", { type: "DAY_ELAPSED", daysSinceDue: 100 })
        ).toBe("PAID");
      });
    });

    describe("COD walk (day-1 / day-8 / day-15 timeline)", () => {
      it("follows INVOICE_ISSUED -> AWAITING_CASH -> GRACE -> PAST_DUE -> SUSPENDED -> PAID", () => {
        let state: InvoiceState = "INVOICE_ISSUED";

        // Step 1: Issue as COD
        state = nextState(state, { type: "ISSUED", method: "COD" });
        expect(state).toBe("AWAITING_CASH");

        // Step 2: Day 1 elapsed → GRACE
        state = nextState(state, { type: "DAY_ELAPSED", daysSinceDue: 1 });
        expect(state).toBe("GRACE");

        // Step 3: Day 8 elapsed → PAST_DUE
        state = nextState(state, { type: "DAY_ELAPSED", daysSinceDue: 8 });
        expect(state).toBe("PAST_DUE");

        // Step 4: Day 15 elapsed → SUSPENDED
        state = nextState(state, { type: "DAY_ELAPSED", daysSinceDue: 15 });
        expect(state).toBe("SUSPENDED");

        // Step 5: Cash recorded → PAID
        state = nextState(state, { type: "CASH_RECORDED" });
        expect(state).toBe("PAID");
      });
    });

    describe("E-payment 3-retry walk", () => {
      it("follows 3 consecutive failures from AWAITING_AUTO_CHARGE to PAST_DUE", () => {
        let state: InvoiceState = "INVOICE_ISSUED";

        // Issue as E_PAYMENT
        state = nextState(state, { type: "ISSUED", method: "E_PAYMENT" });
        expect(state).toBe("AWAITING_AUTO_CHARGE");

        // Attempt 1 fails
        state = nextState(state, { type: "CHARGE_FAILED", attempt: 1 });
        expect(state).toBe("RETRYING");

        // Attempt 2 fails
        state = nextState(state, { type: "CHARGE_FAILED", attempt: 2 });
        expect(state).toBe("RETRYING");

        // Attempt 3 fails → PAST_DUE
        state = nextState(state, { type: "CHARGE_FAILED", attempt: 3 });
        expect(state).toBe("PAST_DUE");
      });

      it("succeeds after retry", () => {
        let state: InvoiceState = "INVOICE_ISSUED";

        // Issue as E_PAYMENT
        state = nextState(state, { type: "ISSUED", method: "E_PAYMENT" });
        expect(state).toBe("AWAITING_AUTO_CHARGE");

        // Attempt 1 fails
        state = nextState(state, { type: "CHARGE_FAILED", attempt: 1 });
        expect(state).toBe("RETRYING");

        // Charge succeeds
        state = nextState(state, { type: "CHARGE_SUCCEEDED" });
        expect(state).toBe("PAID");
      });
    });
  });

  describe("subscriptionStatusFor", () => {
    it("maps INVOICE_ISSUED to ACTIVE", () => {
      expect(subscriptionStatusFor("INVOICE_ISSUED")).toBe("ACTIVE");
    });

    it("maps AWAITING_AUTO_CHARGE to ACTIVE", () => {
      expect(subscriptionStatusFor("AWAITING_AUTO_CHARGE")).toBe("ACTIVE");
    });

    it("maps AWAITING_CASH to ACTIVE", () => {
      expect(subscriptionStatusFor("AWAITING_CASH")).toBe("ACTIVE");
    });

    it("maps RETRYING to ACTIVE", () => {
      expect(subscriptionStatusFor("RETRYING")).toBe("ACTIVE");
    });

    it("maps PAID to ACTIVE", () => {
      expect(subscriptionStatusFor("PAID")).toBe("ACTIVE");
    });

    it("maps GRACE to GRACE", () => {
      expect(subscriptionStatusFor("GRACE")).toBe("GRACE");
    });

    it("maps PAST_DUE to PAST_DUE", () => {
      expect(subscriptionStatusFor("PAST_DUE")).toBe("PAST_DUE");
    });

    it("maps SUSPENDED to SUSPENDED", () => {
      expect(subscriptionStatusFor("SUSPENDED")).toBe("SUSPENDED");
    });
  });

  describe("RETRY_DAYS constant", () => {
    it("exports the retry schedule", () => {
      expect(RETRY_DAYS).toEqual([1, 3, 7]);
    });

    it("has correct length", () => {
      expect(RETRY_DAYS).toHaveLength(3);
    });
  });

  describe("boundary checks", () => {
    it("AWAITING_CASH with DAY_ELAPSED(0) stays AWAITING_CASH", () => {
      expect(
        nextState("AWAITING_CASH", { type: "DAY_ELAPSED", daysSinceDue: 0 })
      ).toBe("AWAITING_CASH");
    });

    it("GRACE with DAY_ELAPSED(7) stays GRACE", () => {
      expect(
        nextState("GRACE", { type: "DAY_ELAPSED", daysSinceDue: 7 })
      ).toBe("GRACE");
    });

    it("PAST_DUE with DAY_ELAPSED(14) stays PAST_DUE", () => {
      expect(
        nextState("PAST_DUE", { type: "DAY_ELAPSED", daysSinceDue: 14 })
      ).toBe("PAST_DUE");
    });
  });
});
