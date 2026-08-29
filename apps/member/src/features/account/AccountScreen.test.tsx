import { fireEvent, render, screen } from "@testing-library/react-native";
import type { EntitlementSummary, Plan } from "@autocare/contracts";
import { AccountScreen } from "./AccountScreen";
import type { SubscriptionWithPlan } from "../subscription/subscriptionApi";

const basic = {
  id: "p-basic", code: "BASIC", name: "Care Basic", priceCentavos: 89900,
  billingInterval: "MONTHLY", lockInMonths: 0,
  entitlements: [{ id: "e1", entitlementType: "INSPECTION", quantityPerCycle: 1 }],
} as unknown as Plan;

const plus = {
  id: "p-plus", code: "PLUS", name: "Care Plus", priceCentavos: 149900,
  billingInterval: "MONTHLY", lockInMonths: 6,
  entitlements: [
    { id: "e2", entitlementType: "INSPECTION", quantityPerCycle: 2 },
    { id: "e3", entitlementType: "ROADSIDE_CALLOUT", quantityPerCycle: 2 },
  ],
} as unknown as Plan;

const subscription = {
  id: "sub-1", status: "ACTIVE",
  currentPeriodEnd: "2026-09-15T00:00:00.000Z",
  lockInEndsAt: "2027-01-15T00:00:00.000Z",
  plan: { id: "p-plus", code: "PLUS", name: "Care Plus", priceCentavos: 149900, billingInterval: "MONTHLY", lockInMonths: 6 },
} as unknown as SubscriptionWithPlan;

const entitlements = [
  { entitlementType: "INSPECTION", quantityPerCycle: 2, remaining: 1 },
] as unknown as EntitlementSummary[];

const noop = () => undefined;
const props = {
  name: "Rielle Tatel", email: "rielle@example.ph",
  subscription, entitlements, plans: [basic, plus],
  onChangePlan: noop, onPersonalDetails: noop, onSubscriptionDetails: noop,
  onInvoices: noop, onPrivacy: noop, onSignOut: noop,
};

describe("AccountScreen (M-28/M-29)", () => {
  it("shows identity, plan name and status", () => {
    render(<AccountScreen {...props} />);
    expect(screen.getByText("Rielle Tatel · rielle@example.ph")).toBeTruthy();
    // "Care Plus" appears twice — the status card and its own plan card.
    expect(screen.getAllByText("Care Plus").length).toBe(2);
    expect(screen.getByText("ACTIVE")).toBeTruthy();
  });

  it("shows the next billing date with the plan price", () => {
    render(<AccountScreen {...props} />);
    expect(screen.getByTestId("next-billing")).toHaveTextContent(/September 15, 2026|15 September 2026/);
    // Thousands grouping depends on the ICU build, so assert the digits only.
    expect(screen.getByTestId("next-billing")).toHaveTextContent(/1,?499/);
  });

  it("marks the current plan as current and non-actionable", () => {
    const onChangePlan = jest.fn();
    render(<AccountScreen {...props} onChangePlan={onChangePlan} />);
    const current = screen.getByTestId("plan-p-plus");
    expect(current.props.accessibilityState).toMatchObject({ selected: true, disabled: true });
    fireEvent.press(current);
    expect(onChangePlan).not.toHaveBeenCalled();
  });

  it("labels a cheaper plan Downgrade and routes the change", () => {
    const onChangePlan = jest.fn();
    render(<AccountScreen {...props} onChangePlan={onChangePlan} />);
    expect(screen.getByText("Downgrade")).toBeTruthy();
    fireEvent.press(screen.getByTestId("plan-p-basic"));
    expect(onChangePlan).toHaveBeenCalledWith(basic);
  });

  it("lists every plan inclusion", () => {
    render(<AccountScreen {...props} />);
    expect(screen.getByText("• 2 inspection/cycle")).toBeTruthy();
    expect(screen.getByText("• 2 roadside callout/cycle")).toBeTruthy();
  });

  it("routes each settings row", () => {
    const handlers = {
      onPersonalDetails: jest.fn(), onSubscriptionDetails: jest.fn(),
      onInvoices: jest.fn(), onPrivacy: jest.fn(),
    };
    render(<AccountScreen {...props} {...handlers} />);
    fireEvent.press(screen.getByTestId("row-personal"));
    fireEvent.press(screen.getByTestId("row-subscription"));
    fireEvent.press(screen.getByTestId("row-invoices"));
    fireEvent.press(screen.getByTestId("row-privacy"));
    for (const fn of Object.values(handlers)) expect(fn).toHaveBeenCalled();
  });

  it("signs out", () => {
    const onSignOut = jest.fn();
    render(<AccountScreen {...props} onSignOut={onSignOut} />);
    fireEvent.press(screen.getByTestId("sign-out"));
    expect(onSignOut).toHaveBeenCalled();
  });

  it("degrades to a plain message when there is no subscription", () => {
    render(<AccountScreen {...props} subscription={null} entitlements={[]} />);
    expect(screen.getByTestId("no-subscription")).toBeTruthy();
    expect(screen.queryByTestId("status-banner")).toBeNull();
  });

  it("files each settings row under what it is about", () => {
    render(<AccountScreen {...props} />);
    screen.getByText("ACCOUNT");
    screen.getByText("BILLING");
    screen.getByText("LEGAL & DATA");
    // Grouping is presentation only — every row still reaches its own screen.
    expect(screen.getByTestId("row-personal")).toBeTruthy();
    expect(screen.getByTestId("row-subscription")).toBeTruthy();
    expect(screen.getByTestId("row-invoices")).toBeTruthy();
    expect(screen.getByTestId("row-privacy")).toBeTruthy();
  });
});
