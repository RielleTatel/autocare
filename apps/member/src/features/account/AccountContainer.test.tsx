import { act, configure, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccountContainer } from "./AccountContainer";
import { api } from "../../shared/api";
import { Plan, Vehicle } from "@autocare/contracts";
jest.mock("../../shared/api", () => ({ api: { get: jest.fn(), post: jest.fn() } }));
configure({ asyncUtilTimeout: 5000 });
const basic = { id: "basic", name: "Basic", code: "BASIC", priceCentavos: 10000, billingInterval: "MONTHLY", lockInMonths: 0, entitlements: [], isActive: true, version: 1 } as Plan;
const plus = { ...basic, id: "plus", name: "Plus", priceCentavos: 20000 };
const vehicles = [{ id: "v1", plateNo: "AAA1234" }, { id: "v2", plateNo: "BBB1234" }] as Vehicle[];
const sub = { id: "s1", vehicleId: "v1", planId: "basic", plan: basic, status: "ACTIVE", startedAt: "2026-11-01T00:00:00Z", currentPeriodEnd: "2026-12-01T00:00:00Z", lockInEndsAt: "2026-11-01T00:00:00Z" };
function setup(list: any[] = []) {
  const focus: { current?: () => void } = {};
  const navigate = jest.fn();
  const navigation = { navigate, getParent: () => ({ navigate }), addListener: (_: string, fn: () => void) => { focus.current = fn; return jest.fn(); } };
  (api.get as jest.Mock).mockImplementation(async (path: string) => {
    if (path === "/users/me") return { name: "Tester" };
    if (path === "/plans") return [basic, plus];
    if (path === "/subscriptions") return list;
    if (path.endsWith("/entitlements")) return [];
    throw new Error("Unexpected request");
  });
  return { navigate, navigation, focus };
}
beforeEach(() => jest.clearAllMocks());
it("routes a first plan choice for the selected vehicle, without mutating billing", async () => {
  const { navigate, navigation } = setup();
  const screen = render(<AccountContainer vehicles={vehicles} firstName="Tester" navigation={navigation} onSignOut={jest.fn()} />);
  await waitFor(() => expect(screen.queryByTestId("subscription-loading")).toBeNull(), { timeout: 5000 });
  fireEvent.press(screen.getByTestId("account-vehicle-v2"));
  await waitFor(() => expect(screen.queryByTestId("subscription-loading")).toBeNull());
  fireEvent.press(screen.getByTestId("plan-plus"));
  expect(navigate).toHaveBeenCalledWith("PaymentMethod", { vehicleId: "v2", plan: plus });
  expect(api.post).not.toHaveBeenCalled();
});
it("preserves the originally selected change plan and ignores another vehicle's subscription", async () => {
  const { navigate, navigation } = setup([sub, { ...sub, id: "s2", vehicleId: "v2", planId: "plus", plan: plus }]);
  const screen = render(<AccountContainer vehicles={vehicles} firstName="Tester" navigation={navigation} onSignOut={jest.fn()} />);
  await waitFor(() => expect(screen.queryByTestId("subscription-loading")).toBeNull());
  fireEvent.press(screen.getByTestId("plan-basic"));
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId("plan-plus"));
  expect(navigate).toHaveBeenCalledWith("UpgradeDowngrade", { subscriptionId: "s1", targetPlan: plus });
});
it("does not treat an unsuccessful subscription read as absence, and recovers on retry", async () => {
  const { navigate, navigation } = setup();
  const get = api.get as jest.Mock;
  const implementation = get.getMockImplementation()!;
  get.mockImplementation((path: string) => path === "/subscriptions" ? Promise.reject(new Error("Offline")) : implementation(path));
  const screen = render(<AccountContainer vehicles={vehicles} firstName="Tester" navigation={navigation} onSignOut={jest.fn()} />);
  await waitFor(() => screen.getByTestId("subscription-error"));
  expect(screen.queryByTestId("plan-plus")).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.queryByTestId("no-subscription")).toBeNull();
  get.mockImplementation(implementation);
  fireEvent.press(screen.getByTestId("account-retry"));
  await waitFor(() => screen.getByTestId("no-subscription"));
});
it("refreshes pending downgrade state on focus, and clears removed pending changes", async () => {
  const pending = { ...sub, pendingPlanId: "plus", pendingPlan: { id: "plus", name: "Plus" } };
  const list = [pending];
  const { navigation, focus } = setup(list);
  const screen = render(<AccountContainer vehicles={vehicles} firstName="Tester" navigation={navigation} onSignOut={jest.fn()} />);
  await waitFor(() => screen.getByTestId("pending-plan"));
  expect(screen.getByTestId("pending-plan")).toHaveTextContent(/Plus is scheduled/);
  list[0] = { ...pending, pendingPlanId: null as any, pendingPlan: null as any };
  await act(async () => { focus.current?.(); });
  await waitFor(() => expect(screen.queryByTestId("pending-plan")).toBeNull());
});
