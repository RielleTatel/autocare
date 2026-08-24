import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { bootstrap, type BootState } from "../features/auth/session";
import { signInWithEmail, registerWithEmail, sendPasswordReset, signInWithGoogle, signOut } from "../features/auth/firebaseAuth";
import { api } from "../shared/api";
import { Plan, Vehicle } from "@autocare/contracts";
import { OnboardingScreen } from "../features/auth/OnboardingScreen";
import { EmailAuthScreen } from "../features/auth/EmailAuthScreen";
import { ConsentScreen } from "../features/auth/ConsentScreen";
import { HomeTabs } from "./HomeTabs";
import { HomeScreen } from "../features/home/HomeScreen";
import { AddVehicleScreen } from "../features/vehicles/AddVehicleScreen";
import { VehiclePhotosScreen } from "../features/vehicles/VehiclePhotosScreen";
import { VehiclesListScreen } from "../features/vehicles/VehiclesListScreen";
import { VehicleDetailScreen } from "../features/vehicles/VehicleDetailScreen";
import { uploadVehiclePhoto } from "../features/vehicles/uploadPhoto";
import { ProfileScreen } from "../features/profile/ProfileScreen";
import { PrivacyScreen } from "../features/profile/PrivacyScreen";
import { makeSubscriptionApi } from "../features/subscription/subscriptionApi";
import { selectManageableSubscription } from "../features/subscription/subscriptionSelection";
import { PlanSelectionScreen } from "../features/subscription/PlanSelectionScreen";
import { PaymentMethodScreen } from "../features/subscription/PaymentMethodScreen";
import { SubscriptionDashboardScreen } from "../features/subscription/SubscriptionDashboardScreen";
import { UpgradeDowngradeScreen } from "../features/subscription/UpgradeDowngradeScreen";
import { CancellationScreen } from "../features/subscription/CancellationScreen";
import { InvoicesScreen } from "../features/subscription/InvoicesScreen";
import { InvoiceDetailScreen } from "../features/subscription/InvoiceDetailScreen";
import { makeBookingApi } from "../features/booking/bookingApi";
import { BookingContainer } from "../features/booking/BookingContainer";
import { BookingsListScreen } from "../features/booking/BookingsListScreen";
import { makeHealthScoreApi, type HealthScore, type HealthScoreHistoryPoint, type InspectionResultDetail } from "../features/health-score/healthScoreApi";
import { HealthScoreScreen } from "../features/health-score/HealthScoreScreen";
import { CategoryBreakdownScreen } from "../features/health-score/CategoryBreakdownScreen";
import { ScoreHistoryScreen } from "../features/health-score/ScoreHistoryScreen";
import { ShareCertificateScreen } from "../features/health-score/ShareCertificateScreen";
import { makeWorkOrderApi, type WorkOrder as MemberWorkOrder, type RecommendationRow } from "../features/work-orders/workOrderApi";
import { ApprovalRequestScreen } from "../features/work-orders/ApprovalRequestScreen";
import { RecommendationsListScreen } from "../features/work-orders/RecommendationsListScreen";
import { ServiceHistoryScreen } from "../features/work-orders/ServiceHistoryScreen";
import { makeAttentionApi, type AttentionItem } from "../features/attention/attentionApi";
import { AttentionCard } from "../features/attention/AttentionCard";
import { AttentionListScreen } from "../features/attention/AttentionListScreen";

const subApi = makeSubscriptionApi(api);
const bookingApi = makeBookingApi(api);
const healthScoreApi = makeHealthScoreApi(api);
const workOrderApi = makeWorkOrderApi(api);
const attentionApi = makeAttentionApi(api);

const Stack = createNativeStackNavigator();

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>AutoCare+</Text>
    </View>
  );
}

/** After Firebase sign-in, ask the API for a session and route by consentRequired.
 * Transitions RootNavigator's top-level boot state rather than navigating within
 * the current (soon-to-be-unmounted) stack, so READY mounts the real vehicle stack. */
async function afterSignIn(navigation: any, setBootState: (s: BootState) => void) {
  const session = await api.createSession();
  if (session.consentRequired) {
    setBootState("NEEDS_CONSENT");
  } else {
    setBootState("READY");
  }
}

function OnboardingContainer({ navigation }: any) {
  return <OnboardingScreen onGetStarted={() => navigation.navigate("EmailAuth")} />;
}

/** Maps Firebase Auth error codes to friendly, user-facing copy. Falls back to
 * a generic message for anything unmapped. */
function registerErrorMessage(e: any): string {
  switch (e?.code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Try signing in instead.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 6 characters).";
    case "auth/network-request-failed":
      return "Cannot reach the server. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Email sign-up is currently unavailable. Please try again later.";
    default:
      return "Couldn't create your account. Please try again.";
  }
}

function EmailAuthContainer({ navigation, setBootState }: any) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <EmailAuthScreen
      error={error}
      notice={notice}
      onSignIn={async (email, password) => {
        setError(null);
        setNotice(null);
        try {
          await signInWithEmail(email, password);
          await afterSignIn(navigation, setBootState);
        } catch {
          setError("That email or password didn't work. Try again.");
        }
      }}
      onRegister={async (email, password) => {
        setError(null);
        setNotice(null);
        try {
          await registerWithEmail(email, password);
          await afterSignIn(navigation, setBootState);
        } catch (e: any) {
          setError(registerErrorMessage(e));
        }
      }}
      onGoogle={async () => {
        setError(null);
        setNotice(null);
        try {
          await signInWithGoogle();
          await afterSignIn(navigation, setBootState);
        } catch {
          setError("Google sign-in failed. Try again.");
        }
      }}
      onForgotPassword={async (email) => {
        setError(null);
        setNotice(null);
        try {
          await sendPasswordReset(email);
          setNotice("Password reset email sent — check your inbox.");
        } catch {
          setError("Couldn't send a reset email. Check the address and try again.");
        }
      }}
    />
  );
}

function ConsentContainer({ setBootState }: any) {
  return <ConsentScreen onConsented={() => setBootState("READY")} />;
}

function HomePlaceholder() {
  // Used pre-READY (ANONYMOUS/NEEDS_CONSENT stacks reset to "Home" before the
  // READY vehicle data is available).
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Home</Text>
    </View>
  );
}

/** Shared data for everything under the READY vehicle stack, provided once by
 * `ReadyStack` and read via `useReady()`. Keeping this in context — rather than
 * threading `vehicles`/`refreshVehicles`/etc. through inline wrapper components
 * passed as `HomeTabs`'s `*Component` props — is what keeps those props'
 * identities stable across renders. An inline `(props) => <X vehicles={vehicles} />`
 * defined fresh in the parent's render body is itself a *new component type*
 * every time `vehicles` changes, and React (independent of React Navigation)
 * remounts on a type change — which re-ran each tab's mount-time fetch effect,
 * which updated `vehicles` again, which re-created the wrapper again: an
 * infinite refetch/remount loop. Module-level components read from context
 * instead, so their identity never changes — only the context value updates,
 * which re-renders (not remounts) the consumers. */
const ReadyContext = createContext<{
  vehicles: Vehicle[];
  refreshVehicles: () => Promise<Vehicle[]>;
  firstName: string;
  setBootState: (s: BootState) => void;
} | null>(null);

function useReady() {
  const ctx = useContext(ReadyContext);
  if (!ctx) throw new Error("useReady() called outside ReadyContext.Provider");
  return ctx;
}

/** Resolves an attention item's deep link to one registered screen (FR-111). */
function resolveAttentionDeepLink(nav: any, item: AttentionItem): void {
  const { screen, params } = item.deepLink;
  nav.navigate(screen, params);
}

/** Home tab container: needs the vehicle list (for the primary card) and stack nav to reach AddVehicle/Detail. */
function HomeTabContainer({ navigation }: any) {
  const { vehicles, firstName } = useReady();
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const parent = navigation.getParent();

  const loadAttention = useCallback(() => {
    attentionApi.mine().then(setAttention).catch(() => undefined);
  }, []);
  useEffect(() => {
    const unsub = navigation.addListener("focus", loadAttention);
    loadAttention();
    return unsub;
  }, [navigation, loadAttention]);

  return (
    <HomeScreen
      firstName={firstName}
      vehicle={vehicles[0] ?? null}
      onAddVehicle={() => parent?.navigate("AddVehicle")}
      onUpdateOdometer={() =>
        vehicles[0]
          ? parent?.navigate("VehicleDetail", { vehicle: vehicles[0] })
          : parent?.navigate("AddVehicle")
      }
      onBookService={vehicles[0] ? () => parent?.navigate("Bookings") : undefined}
      attentionSlot={
        <AttentionCard
          items={attention}
          onSeeAll={() => parent?.navigate("Attention")}
          onPressItem={(item) => resolveAttentionDeepLink(parent, item)}
        />
      }
    />
  );
}

function AttentionContainer({ navigation }: any) {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await attentionApi.mine());
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);
  return (
    <AttentionListScreen
      items={items}
      refreshing={refreshing}
      onRefresh={() => load().catch(() => undefined)}
      onPressItem={(item) => resolveAttentionDeepLink(navigation, item)}
    />
  );
}

/** Resolves the member's vehicle + active subscription, then runs the booking flow (M-19→M-22). */
function BookingFlowContainer({ navigation }: any) {
  const { vehicles } = useReady();
  const vehicle = vehicles[0] ?? null;
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!vehicle) {
      setReady(true);
      return;
    }
    subApi
      .listSubscriptions()
      .then((subs) => setSubscriptionId(selectManageableSubscription(subs, vehicle.id)?.id ?? null))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [vehicle]);

  if (!vehicle || !ready) return <Splash />;
  return (
    <BookingContainer
      api={bookingApi}
      vehicleId={vehicle.id}
      subscriptionId={subscriptionId}
      onBooked={() => navigation.navigate("Bookings")}
    />
  );
}

/** M-23 — the member's bookings list with cancel + "book new". */
function BookingsContainer({ navigation }: any) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const [appts, types] = await Promise.all([bookingApi.listAppointments(), bookingApi.listServiceTypes()]);
    setAppointments(appts);
    setServiceNames(Object.fromEntries(types.map((t) => [t.id, t.name])));
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  return (
    <BookingsListScreen
      appointments={appointments}
      serviceNames={serviceNames}
      now={new Date()}
      onCancel={async (id: string) => {
        await bookingApi.cancel(id).catch(() => {});
        await refresh().catch(() => {});
      }}
      onBookNew={() => navigation.navigate("Booking")}
    />
  );
}

function VehiclesTabContainer({ navigation }: any) {
  const { refreshVehicles } = useReady();
  return (
    <VehiclesListScreen
      fetchVehicles={refreshVehicles}
      onSelectVehicle={(vehicle: Vehicle) => navigation.getParent()?.navigate("VehicleDetail", { vehicle })}
      onAddVehicle={() => navigation.getParent()?.navigate("AddVehicle")}
    />
  );
}

function ProfileTabContainer({ navigation }: any) {
  const { setBootState } = useReady();
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => { api.get("/users/me").then(setProfile).catch(() => setProfile({})); }, []);
  return (
    <ProfileScreen
      initialProfile={profile}
      saveProfile={(data) => api.patch("/users/me", data)}
      onSignOut={async () => {
        await signOut();
        setBootState("ANONYMOUS");
      }}
      onPrivacy={() => navigation.getParent()?.navigate("Privacy")}
    />
  );
}

// Stable component references — passed straight through, never redefined per
// render — so `HomeTabs`'s `Tab.Screen`s never see a changed component type.
function HomeTabsContainer() {
  return (
    <HomeTabs
      HomeComponent={HomeTabContainer}
      VehiclesComponent={VehiclesTabContainer}
      ProfileComponent={ProfileTabContainer}
    />
  );
}

function AddVehicleContainer({ navigation, refreshVehicles }: any) {
  return (
    <AddVehicleScreen
      createVehicle={(data) => api.post<Vehicle>("/vehicles", data)}
      onCreated={async (vehicle: Vehicle) => {
        await refreshVehicles();
        navigation.replace("Photos", { vehicle });
      }}
    />
  );
}

function PhotosContainer({ navigation, route, refreshVehicles }: any) {
  const { vehicle } = route.params;
  const goHome = async () => {
    await refreshVehicles();
    navigation.reset({ index: 0, routes: [{ name: "HomeTabsScreen" }] });
  };
  return (
    <VehiclePhotosScreen
      vehicleId={vehicle.id}
      onDone={goHome}
      pickImage={async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return null;
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (result.canceled || result.assets.length === 0) return null;
        return result.assets[0].uri;
      }}
      uploadPhoto={uploadVehiclePhoto}
      patchVehicle={(id, body) => api.patch(`/vehicles/${id}`, body)}
    />
  );
}

function VehicleDetailContainer({ navigation, route, refreshVehicles }: any) {
  const { vehicle } = route.params;
  return (
    <VehicleDetailScreen
      vehicle={vehicle}
      onUpdateOdometer={async (km: number, justification?: string) => {
        await api.post(`/vehicles/${vehicle.id}/odometer`, { km, justification });
        await refreshVehicles();
      }}
      onArchive={(id: string) => api.del(`/vehicles/${id}`)}
      onArchived={async () => {
        await refreshVehicles();
        navigation.goBack();
      }}
      onBack={() => navigation.goBack()}
      onManageSubscription={async () => {
        const subs = await subApi.listSubscriptions();
        const manageable = selectManageableSubscription(subs, vehicle.id);
        if (manageable) navigation.navigate("SubscriptionDashboard", { subscriptionId: manageable.id });
        else navigation.navigate("PlanSelection", { vehicleId: vehicle.id });
      }}
      onViewHealthScore={() => navigation.navigate("HealthScore", { vehicleId: vehicle.id })}
    />
  );
}

function HealthScoreContainer({ navigation, route }: any) {
  const { vehicleId } = route.params;
  const [score, setScore] = useState<HealthScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    healthScoreApi.getScore(vehicleId).then(setScore).catch((e) => setError(e instanceof Error ? e.message : "No score yet"));
  }, [vehicleId]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg }}>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted, textAlign: "center" }]}>{error}</Text>
      </View>
    );
  }
  if (!score) return <Splash />;
  return (
    <HealthScoreScreen
      score={score}
      onOpenBreakdown={() => navigation.navigate("CategoryBreakdown", { vehicleId })}
      onOpenHistory={() => navigation.navigate("ScoreHistory", { vehicleId })}
      onShare={() => navigation.navigate("ShareCertificate", { vehicleId, healthScoreId: score.id })}
    />
  );
}

function CategoryBreakdownContainer({ route }: any) {
  const { vehicleId } = route.params;
  const [score, setScore] = useState<HealthScore | null>(null);
  const [results, setResults] = useState<InspectionResultDetail[]>([]);
  useEffect(() => {
    healthScoreApi.getScore(vehicleId).then(async (s) => {
      setScore(s);
      const detail = await healthScoreApi.getInspection(vehicleId, s.inspectionId).catch(() => null);
      if (detail) setResults(detail.results);
    }).catch(() => undefined);
  }, [vehicleId]);
  if (!score) return <Splash />;
  return <CategoryBreakdownScreen score={score} results={results} />;
}

function ScoreHistoryContainer({ route }: any) {
  const { vehicleId } = route.params;
  const [history, setHistory] = useState<HealthScoreHistoryPoint[]>([]);
  useEffect(() => {
    healthScoreApi.getHistory(vehicleId).then(setHistory).catch(() => undefined);
  }, [vehicleId]);
  return <ScoreHistoryScreen history={history} />;
}

function ApprovalRequestContainer({ navigation, route }: any) {
  const { workOrderId } = route.params;
  const [wo, setWo] = useState<MemberWorkOrder | null>(null);
  useEffect(() => {
    workOrderApi.getWorkOrder(workOrderId).then(setWo).catch(() => undefined);
  }, [workOrderId]);
  if (!wo) return <Splash />;
  return (
    <ApprovalRequestScreen
      workOrder={wo}
      onSubmit={async (decisions) => {
        await workOrderApi.decide(workOrderId, decisions);
        navigation.goBack();
      }}
    />
  );
}

function RecommendationsContainer({ navigation, route }: any) {
  const { vehicleId } = route.params;
  const [recs, setRecs] = useState<RecommendationRow[]>([]);
  useEffect(() => {
    workOrderApi.getRecommendations(vehicleId).then(setRecs).catch(() => undefined);
  }, [vehicleId]);
  return (
    <RecommendationsListScreen
      recommendations={recs}
      onBookService={() => navigation.navigate("Booking", { vehicleId })}
    />
  );
}

function ServiceHistoryContainer({ route }: any) {
  const { vehicleId } = route.params;
  const [wos, setWos] = useState<MemberWorkOrder[]>([]);
  useEffect(() => {
    workOrderApi.listForVehicle(vehicleId).then(setWos).catch(() => undefined);
  }, [vehicleId]);
  return <ServiceHistoryScreen workOrders={wos} />;
}

function ShareCertificateContainer({ route }: any) {
  const { vehicleId, healthScoreId } = route.params;
  return (
    <ShareCertificateScreen
      createCertificate={() => healthScoreApi.createCertificate(vehicleId, healthScoreId)}
      setVisibility={(certId, visibility) => healthScoreApi.setCertificateVisibility(certId, visibility)}
    />
  );
}

function PlanSelectionContainer({ navigation, route }: any) {
  const { vehicleId } = route.params;
  return (
    <PlanSelectionScreen
      fetchPlans={subApi.listPlans}
      onSelectPlan={(plan: Plan) => navigation.navigate("PaymentMethod", { vehicleId, plan })}
    />
  );
}

/** Finds the most recently issued invoice for a subscription — POST /subscriptions doesn't
 * return the invoice it creates, and there's no `subscriptionId` query filter on GET
 * /invoices, so the freshest matching invoice is looked up client-side right after create. */
async function findLatestInvoiceForSubscription(subscriptionId: string) {
  const invoices = await subApi.listInvoices();
  const matches = invoices
    .filter((i) => i.subscriptionId === subscriptionId)
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  if (!matches[0]) throw new Error("Couldn't find an invoice for this subscription");
  return matches[0];
}

function PaymentMethodContainer({ navigation, route }: any) {
  const { vehicleId, plan } = route.params;
  return (
    <PaymentMethodScreen
      plan={plan}
      createSubscription={(method: "E_PAYMENT" | "COD") => subApi.createSubscription(vehicleId, plan.id, method)}
      createPaymentIntent={async (sub) => {
        const invoice = await findLatestInvoiceForSubscription(sub.id);
        return subApi.createPaymentIntent(invoice.id);
      }}
      openCheckout={(url: string) => WebBrowser.openAuthSessionAsync(url, Linking.createURL("payment-result"))}
      refreshSubscriptionStatus={(id: string) => subApi.getSubscription(id)}
      onDone={(sub) => navigation.reset({ index: 0, routes: [{ name: "SubscriptionDashboard", params: { subscriptionId: sub.id } }] })}
    />
  );
}

function SubscriptionDashboardContainer({ navigation, route }: any) {
  const { subscriptionId } = route.params;
  return (
    <SubscriptionDashboardScreen
      fetchDashboard={async () => {
        const [subscription, entitlements] = await Promise.all([
          subApi.getSubscription(subscriptionId),
          subApi.getEntitlements(subscriptionId),
        ]);
        return { subscription, entitlements };
      }}
      onManagePlan={() => navigation.navigate("UpgradeDowngrade", { subscriptionId })}
      onCancel={() => navigation.navigate("Cancellation", { subscriptionId })}
      onViewInvoices={() => navigation.navigate("Invoices")}
    />
  );
}

function UpgradeDowngradeContainer({ navigation, route }: any) {
  const { subscriptionId } = route.params;
  const [currentPlan, setCurrentPlan] = useState<{ id: string; name: string; priceCentavos: number; billingInterval: string; lockInMonths: number } | null>(null);

  useEffect(() => {
    subApi.getSubscription(subscriptionId).then((s) => setCurrentPlan(s.plan));
  }, [subscriptionId]);

  if (!currentPlan) return <Splash />;

  return (
    <UpgradeDowngradeScreen
      currentPlan={currentPlan}
      fetchPlans={subApi.listPlans}
      onUpgrade={(planId: string) => subApi.upgrade(subscriptionId, planId)}
      onDowngrade={(planId: string) => subApi.downgrade(subscriptionId, planId)}
      onDone={() => navigation.navigate("SubscriptionDashboard", { subscriptionId })}
    />
  );
}

function CancellationContainer({ navigation, route }: any) {
  const { subscriptionId } = route.params;
  return (
    <CancellationScreen
      fetchQuote={() => subApi.cancellationQuote(subscriptionId)}
      onCancel={(acceptEtf: boolean) => subApi.cancel(subscriptionId, acceptEtf)}
      onDone={() => navigation.navigate("SubscriptionDashboard", { subscriptionId })}
    />
  );
}

function InvoicesContainer({ navigation }: any) {
  return (
    <InvoicesScreen
      fetchInvoices={subApi.listInvoices}
      onSelectInvoice={(invoice) => navigation.navigate("InvoiceDetail", { invoice })}
    />
  );
}

function InvoiceDetailContainer({ navigation, route }: any) {
  const { invoice } = route.params;
  return (
    <InvoiceDetailScreen
      invoice={invoice}
      onDownloadReceipt={async () => {
        const { url } = await subApi.getInvoicePdf(invoice.id);
        await WebBrowser.openBrowserAsync(url);
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

function PrivacyContainer() {
  return (
    <PrivacyScreen
      requestDataExport={() => api.post("/users/me/data-export")}
      requestDeletion={() => api.post("/users/me/deletion-request")}
      onSignedOut={async () => { await signOut(); }}
    />
  );
}

/** READY branch: fetches the vehicle list once, then decides the initial
 * screen — a consented member with zero vehicles is deep-linked straight
 * into AddVehicle (first-run flow). */
function ReadyStack({ setBootState }: { setBootState: (s: BootState) => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [firstName, setFirstName] = useState("there");

  const refreshVehicles = useCallback(async () => {
    const list = await api.get<Vehicle[]>("/vehicles");
    setVehicles(list);
    return list;
  }, []);

  useEffect(() => {
    refreshVehicles();
    api.get<{ name: string | null }>("/users/me").then((u) => {
      if (u?.name) setFirstName(u.name.split(" ")[0]);
    }).catch(() => {});
  }, [refreshVehicles]);

  if (vehicles === null) return <Splash />;

  return (
    <ReadyContext.Provider value={{ vehicles, refreshVehicles, firstName, setBootState }}>
    <Stack.Navigator screenOptions={{ headerShown: false }}
      initialRouteName={vehicles.length === 0 ? "AddVehicle" : "HomeTabsScreen"}>
      <Stack.Screen name="HomeTabsScreen" component={HomeTabsContainer} />
      <Stack.Screen name="AddVehicle">
        {(props) => <AddVehicleContainer {...props} refreshVehicles={refreshVehicles} />}
      </Stack.Screen>
      <Stack.Screen name="Photos">
        {(props) => <PhotosContainer {...props} refreshVehicles={refreshVehicles} />}
      </Stack.Screen>
      <Stack.Screen name="VehicleDetail">
        {(props) => <VehicleDetailContainer {...props} refreshVehicles={refreshVehicles} />}
      </Stack.Screen>
      <Stack.Screen name="Privacy" component={PrivacyContainer} />
      <Stack.Screen name="PlanSelection" component={PlanSelectionContainer} />
      <Stack.Screen name="PaymentMethod" component={PaymentMethodContainer} />
      <Stack.Screen name="SubscriptionDashboard" component={SubscriptionDashboardContainer} />
      <Stack.Screen name="UpgradeDowngrade" component={UpgradeDowngradeContainer} />
      <Stack.Screen name="Cancellation" component={CancellationContainer} />
      <Stack.Screen name="Invoices" component={InvoicesContainer} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailContainer} />
      <Stack.Screen name="Booking" component={BookingFlowContainer} />
      <Stack.Screen name="Bookings" component={BookingsContainer} />
      <Stack.Screen name="HealthScore" component={HealthScoreContainer} />
      <Stack.Screen name="CategoryBreakdown" component={CategoryBreakdownContainer} />
      <Stack.Screen name="ScoreHistory" component={ScoreHistoryContainer} />
      <Stack.Screen name="ShareCertificate" component={ShareCertificateContainer} />
      <Stack.Screen name="ApprovalRequest" component={ApprovalRequestContainer} />
      <Stack.Screen name="Recommendations" component={RecommendationsContainer} />
      <Stack.Screen name="ServiceHistory2" component={ServiceHistoryContainer} />
      <Stack.Screen name="Attention" component={AttentionContainer} />
    </Stack.Navigator>
    </ReadyContext.Provider>
  );
}

export function RootNavigator() {
  const [state, setState] = useState<BootState | "PENDING">("PENDING");

  useEffect(() => {
    bootstrap().then(setState);
  }, []);

  if (state === "PENDING") return <Splash />;

  if (state === "READY") {
    return (
      <NavigationContainer>
        <ReadyStack setBootState={setState} />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {state === "ANONYMOUS" && (
          <>
            <Stack.Screen name="Onboarding">
              {(props) => <OnboardingContainer {...props} setBootState={setState} />}
            </Stack.Screen>
            <Stack.Screen name="EmailAuth">
              {(props) => <EmailAuthContainer {...props} setBootState={setState} />}
            </Stack.Screen>
            <Stack.Screen name="Consent">
              {(props) => <ConsentContainer {...props} setBootState={setState} />}
            </Stack.Screen>
            <Stack.Screen name="Home" component={HomePlaceholder} />
          </>
        )}
        {state === "NEEDS_CONSENT" && (
          <>
            <Stack.Screen name="Consent">
              {(props) => <ConsentContainer {...props} setBootState={setState} />}
            </Stack.Screen>
            <Stack.Screen name="Home" component={HomePlaceholder} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
