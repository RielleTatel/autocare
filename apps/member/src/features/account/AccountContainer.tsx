import { useCallback, useEffect, useRef, useState } from "react";
import { EntitlementSummary, Plan, Vehicle } from "@autocare/contracts";
import { api } from "../../shared/api";
import { makeSubscriptionApi, SubscriptionWithPlan } from "../subscription/subscriptionApi";
import { selectManageableSubscription } from "../subscription/subscriptionSelection";
import { AccountScreen } from "./AccountScreen";

const subscriptions = makeSubscriptionApi(api);

/** The production Account connection: absence is actionable only after a successful read. */
export function AccountContainer({ vehicles, firstName, navigation, onSignOut }: {
  vehicles: Vehicle[]; firstName: string; navigation: any; onSignOut: () => void;
}) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const vehicle = vehicles.find(v => v.id === vehicleId) ?? vehicles[0];
  const [profile, setProfile] = useState<{ name?: string; email?: string }>({});
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementSummary[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++request.current;
    setLoading(true); setError(null); setSubscription(null); setEntitlements([]);
    try {
      const [user, catalog, list] = await Promise.all([
        api.get<{ name?: string; email?: string }>("/users/me"),
        subscriptions.listPlans(), subscriptions.listSubscriptions(),
      ]);
      if (requestId !== request.current) return;
      const selected = vehicle ? selectManageableSubscription(list, vehicle.id) : null;
      setProfile(user); setPlans(catalog); setSubscription(selected);
      const entitlementList = selected ? await subscriptions.getEntitlements(selected.id) : [];
      if (requestId === request.current) setEntitlements(entitlementList);
    } catch (e) {
      if (requestId === request.current) setError(e instanceof Error ? e.message : "Couldn't load your subscription. Try again.");
    } finally { if (requestId === request.current) setLoading(false); }
  }, [vehicle?.id]);
  useEffect(() => {
    void load();
    return navigation.addListener?.("focus", load);
  }, [navigation, load]);
  const parent = () => navigation.getParent?.() ?? navigation;
  return <AccountScreen
    name={profile.name || firstName} email={profile.email}
    subscription={subscription} entitlements={entitlements} plans={plans}
    refreshing={loading} subscriptionLoading={loading} subscriptionError={error}
    vehicles={vehicles} selectedVehicleId={vehicle?.id} onSelectVehicle={setVehicleId}
    onRefresh={() => void load()}
    onChangePlan={(plan) => {
      if (loading || error) return;
      if (!vehicle) { parent().navigate("AddVehicle"); return; }
      if (subscription) {
        if (plan.id !== subscription.planId) parent().navigate("UpgradeDowngrade", { subscriptionId: subscription.id, targetPlan: plan });
      } else parent().navigate("PaymentMethod", { vehicleId: vehicle.id, plan });
    }}
    onPersonalDetails={() => parent().navigate("PersonalDetails")}
    onSubscriptionDetails={() => {
      if (!loading && !error && subscription) parent().navigate("SubscriptionDashboard", { subscriptionId: subscription.id });
    }}
    onInvoices={() => parent().navigate("Invoices", { subscriptionId: subscription?.id })}
    onPrivacy={() => parent().navigate("Privacy")} onSignOut={onSignOut}
  />;
}
