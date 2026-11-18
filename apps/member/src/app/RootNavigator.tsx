import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { NavigationContainer, useIsFocused } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { Skeleton } from "../components/Skeleton";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { useHealthInspection } from "../features/health-score/useHealthInspection";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { bootstrap, type BootState } from "../features/auth/session";
import { signInWithEmail, registerWithEmail, sendPasswordReset, signInWithGoogle, signOut } from "../features/auth/firebaseAuth";
import { api } from "../shared/api";
import { EntitlementSummary, Plan, Vehicle } from "@autocare/contracts";
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
import { AccountContainer } from "../features/account/AccountContainer";
import { PrivacyScreen } from "../features/profile/PrivacyScreen";
import { makeSubscriptionApi, type SubscriptionWithPlan } from "../features/subscription/subscriptionApi";
import { selectManageableSubscription } from "../features/subscription/subscriptionSelection";
import { PlanSelectionScreen } from "../features/subscription/PlanSelectionScreen";
import { PaymentMethodScreen } from "../features/subscription/PaymentMethodScreen";
import { SubscriptionDashboardScreen } from "../features/subscription/SubscriptionDashboardScreen";
import { UpgradeDowngradeScreen } from "../features/subscription/UpgradeDowngradeScreen";
import { CancellationScreen } from "../features/subscription/CancellationScreen";
import { InvoicesScreen } from "../features/subscription/InvoicesScreen";
import { InvoicePaymentScreen } from "../features/subscription/InvoicePaymentScreen";
import { openCheckout } from "../features/subscription/openCheckout";
import { newIdempotencyKey } from "../features/subscription/billingPreview";
import { makeBookingApi } from "../features/booking/bookingApi";
import { BookingContainer } from "../features/booking/BookingContainer";
import { BookingsListScreen } from "../features/booking/BookingsListScreen";
import { makeHealthScoreApi, type HealthScore, type HealthScoreHistoryPoint } from "../features/health-score/healthScoreApi";
import { HealthScoreScreen } from "../features/health-score/HealthScoreScreen";
import { VehicleHealthDiagramScreen } from "../features/health-score/VehicleHealthDiagramScreen";
import { useDiagramInspection } from "../features/health-score/useDiagramInspection";
import { CategoryBreakdownScreen } from "../features/health-score/CategoryBreakdownScreen";
import { ScoreHistoryScreen } from "../features/health-score/ScoreHistoryScreen";
import { ShareCertificateScreen } from "../features/health-score/ShareCertificateScreen";
import { makeWorkOrderApi, type WorkOrder as MemberWorkOrder, type RecommendationRow } from "../features/work-orders/workOrderApi";
import { ApprovalRequestScreen } from "../features/work-orders/ApprovalRequestScreen";
import { RecommendationsListScreen } from "../features/work-orders/RecommendationsListScreen";
import { ServiceHistoryScreen } from "../features/work-orders/ServiceHistoryScreen";
import { InspectionHistoryRoute, InspectionReportRoute, RepairProgressRoute, ServiceBillRoute } from "../features/service-history/ServiceHistoryRoutes";
import { makeAttentionApi, type AttentionItem } from "../features/attention/attentionApi";
import { AnnouncementsScreen } from "../features/announcements/AnnouncementsScreen";
import { makeAnnouncementsApi, type AnnouncementFeed } from "../features/announcements/announcementsApi";
import { AttentionCard } from "../features/attention/AttentionCard";
import { RoadsideContainer } from "../features/roadside/RoadsideContainer";
import { AttentionListScreen } from "../features/attention/AttentionListScreen";

const splashMark = require("../../assets/logo-mark.png");

const subApi = makeSubscriptionApi(api);
const bookingApi = makeBookingApi(api);
const healthScoreApi = makeHealthScoreApi(api);
const workOrderApi = makeWorkOrderApi(api);
const attentionApi = makeAttentionApi(api);
const announcementsApi = makeAnnouncementsApi(api);

const Stack = createNativeStackNavigator();

/**
 * Every stack screen clears the status bar / notch here rather than each screen
 * padding itself — a screen added later inherits it instead of forgetting it.
 * Bottom inset is left to TabBar, which already handles the home indicator.
 */
function useScreenOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    contentStyle: { paddingTop: insets.top, backgroundColor: theme.colors.chassis },
  } as const;
}


/**
 * App boot only — the wait before auth resolves and there is no known layout to
 * preview. Every in-app wait uses Skeleton.Screen instead, which previews the
 * screen that is coming.
 */
function Splash() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center", gap: theme.spacing.md }}>
      <Image source={splashMark} style={{ width: 180, height: 180, borderRadius: theme.radii.md }} />
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>AutoCare+</Text>
    </SafeAreaView>
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

/** Shown when Firebase auth succeeds but the follow-up call to our own API
 * (afterSignIn → api.createSession) fails — a server/network problem, not
 * bad credentials, so it must not be reported as one. */
const SESSION_ERROR = "Signed in, but couldn't reach AutoCare+. Check your connection and try again.";

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
        } catch {
          setError("That email or password didn't work. Try again.");
          return;
        }
        try {
          await afterSignIn(navigation, setBootState);
        } catch {
          setError(SESSION_ERROR);
        }
      }}
      onRegister={async (email, password) => {
        setError(null);
        setNotice(null);
        try {
          await registerWithEmail(email, password);
        } catch (e: any) {
          setError(registerErrorMessage(e));
          return;
        }
        try {
          await afterSignIn(navigation, setBootState);
        } catch {
          setError(SESSION_ERROR);
        }
      }}
      onGoogle={async () => {
        setError(null);
        setNotice(null);
        try {
          await signInWithGoogle();
        } catch {
          setError("Google sign-in failed. Try again.");
          return;
        }
        try {
          await afterSignIn(navigation, setBootState);
        } catch {
          setError(SESSION_ERROR);
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
  const [planLabel, setPlanLabel] = useState<string | undefined>(undefined);
  const [health, setHealth] = useState<{ vehicleId: string; score: number; band: HealthScore["band"]; inspectedAt?: string | null } | null>(null);
  const healthRequest = useRef(0);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  // null is the honest "not known yet" — the card falls back to its generic
  // line rather than claiming zero cover while the request is in flight.
  const [roadsideCallouts, setRoadsideCallouts] = useState<number | null>(null);
  const parent = navigation.getParent();
  const primary = vehicles[0] ?? null;

  // Both refresh on focus, so returning from the feed with everything read
  // clears the masthead badge rather than leaving a stale count on Home.
  const loadHome = useCallback(() => {
    attentionApi.mine().then(setAttention).catch(() => undefined);
    announcementsApi.mine()
      .then((f) => setUnreadAnnouncements(f.unreadCount))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const unsub = navigation.addListener("focus", loadHome);
    loadHome();
    return unsub;
  }, [navigation, loadHome]);

  // Subscription line under the greeting ("Care Plus · next billing 15 Sep 2026"),
  // plus the roadside call-out balance the quick-action card shows.
  useEffect(() => {
    subApi.listSubscriptions().then(async (subs) => {
      const active = subs.find((s) => s.status === "ACTIVE") ?? subs[0];
      if (!active) return;
      const entitlements = await subApi.getEntitlements(active.id).catch(() => []);
      setRoadsideCallouts(entitlements.find((e) => e.entitlementType === "ROADSIDE")?.remaining ?? null);
      const date = new Date(active.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      setPlanLabel(`${active.plan.name} · next billing ${date}`);
    }).catch(() => undefined);
  }, []);

  // Band + stars + score on the vehicle card, if the primary vehicle is inspected.
  // Refreshes on focus so a review completed elsewhere (e.g. field app) shows up on return.
  const loadHealth = useCallback(() => {
    const generation = ++healthRequest.current;
    setHealth(null);
    if (!primary) {
      return;
    }
    healthScoreApi.getScore(primary.id)
      .then((s) => {
        if (generation === healthRequest.current && s.vehicleId === primary.id) setHealth({ vehicleId: s.vehicleId, score: s.score, band: s.band, inspectedAt: s.inspectedAt });
      })
      .catch(() => undefined);
  }, [primary?.id]);
  useEffect(() => {
    const unsub = navigation.addListener("focus", loadHealth);
    loadHealth();
    return () => { unsub(); healthRequest.current++; };
  }, [navigation, loadHealth]);

  return (
    <HomeScreen
      firstName={firstName}
      vehicle={primary}
      planLabel={planLabel}
      health={health?.vehicleId === primary?.id ? health : null}
      onAddVehicle={() => parent?.navigate("AddVehicle")}
      onUpdateOdometer={() =>
        primary
          ? parent?.navigate("VehicleDetail", { vehicle: primary })
          : parent?.navigate("AddVehicle")
      }
      onBookService={primary ? () => parent?.navigate("Bookings") : undefined}
      onOpenHealthScore={primary ? () => parent?.navigate("VehicleDetail", { vehicle: primary }) : undefined}
      onRoadside={primary ? () => parent?.navigate("Roadside", { vehicleId: primary.id }) : undefined}
      roadsideCallouts={roadsideCallouts}
      onAnnouncements={() => parent?.navigate("Announcements")}
      unreadAnnouncements={unreadAnnouncements}
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

/** M-33 (subset) — the announcements feed. Tapping a vehicle-scoped thread deep-links to
 *  booking, which is the action every service-due and appointment thread is about. */
function AnnouncementsContainer({ navigation }: any) {
  const [feed, setFeed] = useState<AnnouncementFeed>({ items: [], unreadCount: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setFeed(await announcementsApi.mine());
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <AnnouncementsScreen
      items={feed.items}
      unreadCount={feed.unreadCount}
      refreshing={refreshing}
      onRefresh={() => load().catch(() => undefined)}
      onMarkAllRead={() => {
        announcementsApi.markAllRead().then(load).catch(() => undefined);
      }}
      onPressItem={(item) => {
        announcementsApi.markRead(item.id).catch(() => undefined);
        if (item.vehicleId && item.serviceTypeId) {
          navigation.navigate("Booking", { vehicleId: item.vehicleId, serviceTypeId: item.serviceTypeId });
        }
      }}
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

  if (!vehicle || !ready) return <Skeleton.Screen cards={2} />;
  return (
    <BookingContainer
      api={bookingApi}
      vehicleId={vehicle.id}
      vehicle={vehicle}
      subscriptionId={subscriptionId}
      onBooked={() => navigation.navigate("Bookings")}
    />
  );
}

/** M-23 — the member's bookings list with cancel + "book new". */
function BookingsContainer({ navigation }: any) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const [appts, types] = await Promise.all([bookingApi.listAppointments(), bookingApi.listServiceTypes()]);
    setAppointments(appts);
    setServiceNames(Object.fromEntries(types.map((t) => [t.id, t.name])));
    // Names a booking's vehicle. Secondary to the list itself: on failure the
    // rows simply omit the vehicle line rather than the screen failing.
    const vehicles = await api.get<Vehicle[]>("/vehicles").catch(() => []);
    setVehicleLabels(Object.fromEntries(vehicles.map((v) => [v.id, `${v.year} ${v.make} ${v.model}`])));
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  return (
    <BookingsListScreen
      appointments={appointments}
      serviceNames={serviceNames}
      vehicleLabels={vehicleLabels}
      now={new Date()}
      onCancel={async (id: string) => {
        await bookingApi.cancel(id).catch(() => {});
        await refresh().catch(() => {});
      }}
      onBookNew={() => (navigation.getParent() ?? navigation).navigate("Booking")}
    />
  );
}

function VehiclesTabContainer({ navigation }: any) {
  const { refreshVehicles } = useReady();
  return (
    <VehiclesListScreen
      fetchVehicles={refreshVehicles}
      fetchHealth={(vehicleId: string) =>
        healthScoreApi.getScore(vehicleId).then((s) => s.vehicleId === vehicleId ? { score: s.score, band: s.band, inspectedAt: s.inspectedAt } : null).catch(() => null)
      }
      onSelectVehicle={(vehicle: Vehicle) => navigation.getParent()?.navigate("VehicleDetail", { vehicle })}
      onAddVehicle={() => navigation.getParent()?.navigate("AddVehicle")}
    />
  );
}

/** M-28 "Personal details" — the profile edit form, now pushed from the
 *  Account tab rather than being the whole tab. */
function PersonalDetailsContainer({ navigation }: any) {
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
      onPrivacy={() => navigation.navigate("Privacy")}
    />
  );
}

/** M-28/M-29 Account tab: identity, plan + status, inline plan switching and the
 *  settings rows. Subscription resolution mirrors BookingFlowContainer — the
 *  member's first vehicle carries the manageable subscription. */
function AccountTabContainer({ navigation }: any) {
  const { vehicles, firstName, setBootState } = useReady();
  return <AccountContainer vehicles={vehicles} firstName={firstName} navigation={navigation}
    onSignOut={async () => { await signOut(); setBootState("ANONYMOUS"); }} />;
}

// Stable component references — passed straight through, never redefined per
// render — so `HomeTabs`'s `Tab.Screen`s never see a changed component type.
function HomeTabsContainer() {
  return (
    <HomeTabs
      HomeComponent={HomeTabContainer}
      VehiclesComponent={VehiclesTabContainer}
      BookingsComponent={BookingsContainer}
      AccountComponent={AccountTabContainer}
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
  const editing = route.params?.editing === true;
  const finish = async () => {
    await refreshVehicles();
    if (editing) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: "HomeTabsScreen" }] });
  };
  return (
    <VehiclePhotosScreen
      vehicleId={vehicle.id}
      initialPhotoUrls={vehicle.photoUrls ?? []}
      initialOrCrUrls={vehicle.orCrUrls ?? []}
      onDone={finish}
      pickImage={async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return null;
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.7,
        });
        if (result.canceled || result.assets.length === 0) return null;
        return result.assets[0].uri;
      }}
      uploadPhoto={uploadVehiclePhoto}
      patchVehicle={(id, body) => api.patch(`/vehicles/${id}`, body)}
    />
  );
}

function VehicleDetailContainer({ navigation, route, refreshVehicles }: any) {
  const initialVehicle = route.params.vehicle as Vehicle;
  const [loadedVehicle, setVehicle] = useState<Vehicle>(initialVehicle);
  const vehicle = loadedVehicle.id === initialVehicle.id ? loadedVehicle : initialVehicle;
  const [loadedHealth, setHealth] = useState<{ vehicleId: string; score: number; band: HealthScore["band"]; inspectedAt?: string | null } | null>(null);
  const health = loadedHealth?.vehicleId === vehicle.id ? loadedHealth : null;
  const healthRequest = useRef(0);
  // null while unknown, so the stat shows "—" rather than a confident zero.
  const [loadedOpenItems, setOpenItems] = useState<{ vehicleId: string; count: number } | null>(null);
  const openItems = loadedOpenItems?.vehicleId === vehicle.id ? loadedOpenItems.count : null;

  // Focused-only vehicles legitimately have no full score. Their reports remain
  // reachable through inspection history.
  // Refreshes on focus so a review completed elsewhere shows up on return.
  const loadHealth = useCallback(() => {
    const generation = ++healthRequest.current;
    setHealth(null);
    setOpenItems(null);
    api.get<Vehicle>(`/vehicles/${initialVehicle.id}`).then(next => {
      if (generation === healthRequest.current && next.id === initialVehicle.id) setVehicle(next);
    }).catch(() => undefined);
    healthScoreApi.getScore(vehicle.id)
      .then((s) => {
        if (generation === healthRequest.current && s.vehicleId === vehicle.id) setHealth({ vehicleId: s.vehicleId, score: s.score, band: s.band, inspectedAt: s.inspectedAt });
      })
      .catch(() => { if (generation === healthRequest.current) setHealth(null); });
    // The attention feed is per-member and already carries vehicleId, so the
    // "items to watch" stat is a filter rather than another round trip.
    attentionApi.mine()
      .then((items) => {
        if (generation === healthRequest.current) setOpenItems({ vehicleId: vehicle.id, count: items.filter((i) => i.vehicleId === vehicle.id).length });
      })
      .catch(() => { if (generation === healthRequest.current) setOpenItems(null); });
  }, [initialVehicle.id, vehicle.id]);
  useEffect(() => {
    const unsub = navigation.addListener("focus", loadHealth);
    loadHealth();
    return () => { unsub(); healthRequest.current++; };
  }, [navigation, loadHealth]);

  return (
    <VehicleDetailScreen
      vehicle={vehicle}
      health={health}
      openItems={openItems}
      lastServiceAt={vehicle.lastServiceAt ?? null}
      onBookService={() => navigation.navigate("Booking", { vehicleId: vehicle.id })}
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
      onEditPhotos={() => navigation.navigate("Photos", { vehicle, editing: true })}
      onManageSubscription={async () => {
        const subs = await subApi.listSubscriptions();
        const manageable = selectManageableSubscription(subs, vehicle.id);
        if (manageable) navigation.navigate("SubscriptionDashboard", { subscriptionId: manageable.id });
        else navigation.navigate("PlanSelection", { vehicleId: vehicle.id });
      }}
      onViewHealthScore={() => navigation.navigate("HealthScore", { vehicleId: vehicle.id })}
      onViewInspectionHistory={() => navigation.navigate("InspectionHistory", { vehicleId: vehicle.id })}
    />
  );
}

function HealthInspectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg, gap: theme.spacing.md }}>
    <Text accessibilityRole="alert" style={[theme.text("body"), { color: theme.colors.inkMuted, textAlign: "center" }]}>{message}</Text>
    <Button onPress={onRetry}>Retry health score</Button>
  </View>;
}

function HealthScoreContainer({ navigation, route }: any) {
  const returningFromDiagram = useRef(false);
  const { vehicleId } = route.params;
  const { score, results, error, noFullInspection, resultsLoading, resultsError, load: loadScore } = useHealthInspection(healthScoreApi, vehicleId);
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      // The diagram is read-only; retain the mounted overview and scroll position.
      if (returningFromDiagram.current) { returningFromDiagram.current = false; return; }
      void loadScore();
    });
    void loadScore();
    return unsub;
  }, [navigation, loadScore]);

  if (error) return <HealthInspectionError message={error} onRetry={loadScore} />;
  if (noFullInspection) return <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
    <Button variant="ghost" icon="chevron-left" onPress={() => navigation.goBack()}>Back</Button>
    <EmptyState title="No full inspection yet" body="Focused inspection findings and repair progress remain available in your vehicle history."
      action={<Button onPress={() => navigation.navigate("InspectionHistory", { vehicleId })}>View inspections & repairs</Button>} />
  </View>;
  if (!score) return <Skeleton.Screen cards={3} />;
  return (
    <HealthScoreScreen
      score={score}
      results={results}
      resultsLoading={resultsLoading}
      resultsError={resultsError}
      onRetryResults={loadScore}
      onOpenDiagram={() => {
        returningFromDiagram.current = true;
        navigation.navigate("VehicleHealthDiagram", { vehicleId, inspectionId: score.inspectionId });
      }}
      onOpenBreakdown={() => navigation.navigate("CategoryBreakdown", { vehicleId })}
      onOpenHistory={() => navigation.navigate("ScoreHistory", { vehicleId })}
      onOpenInspectionHistory={() => navigation.navigate("InspectionHistory", { vehicleId })}
      onShare={() => navigation.navigate("ShareCertificate", { vehicleId, healthScoreId: score.id })}
    />
  );
}

function VehicleHealthDiagramContainer({ navigation, route }: any) {
  const { vehicleId, inspectionId } = route.params;
  const active = useIsFocused();
  const { detail, error, load } = useDiagramInspection(healthScoreApi, vehicleId, inspectionId);
  return <VehicleHealthDiagramScreen detail={detail} error={error} active={active} onRetry={load}
    onBack={() => navigation.goBack()}
    onOpenBreakdown={() => navigation.navigate("CategoryBreakdown", { vehicleId })} />;
}

function CategoryBreakdownContainer({ navigation, route }: any) {
  const { vehicleId } = route.params;
  const { score, results, error, noFullInspection, resultsLoading, resultsError, load } = useHealthInspection(healthScoreApi, vehicleId);
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", load);
    void load();
    return unsubscribe;
  }, [navigation, load]);
  if (error) return <HealthInspectionError message={error} onRetry={load} />;
  if (noFullInspection) return <View style={{ padding: theme.spacing.md }}><EmptyState title="No full inspection yet"
    action={<Button onPress={() => navigation.navigate("InspectionHistory", { vehicleId })}>View inspections & repairs</Button>} /></View>;
  if (!score) return <Skeleton.Screen cards={3} />;
  return <CategoryBreakdownScreen score={score} results={results} resultsLoading={resultsLoading} resultsError={resultsError} onRetryResults={load} />;
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
  if (!wo) return <Skeleton.Screen cards={2} />;
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

function PaymentMethodContainer({ navigation, route }: any) {
  const { vehicleId, plan } = route.params;
  const keys = useRef<Record<string, string>>({});
  return <PaymentMethodScreen plan={plan}
    createSubscription={(method) => {
      const key = keys.current[method] ?? (keys.current[method] = newIdempotencyKey());
      return subApi.createSubscription(vehicleId, plan.id, method, key);
    }}
    onCheckoutInvoice={(invoiceId) => navigation.replace("InvoiceDetail", { invoiceId })}
    onDone={(sub) => navigation.navigate("SubscriptionDashboard", { subscriptionId: sub.id })}
  />;
}

function SubscriptionDashboardContainer({ navigation, route }: any) {
  const { subscriptionId } = route.params;
  return (
    <SubscriptionDashboardScreen
      navigation={navigation}
      fetchDashboard={async () => {
        const [subscription, entitlements] = await Promise.all([
          subApi.getSubscription(subscriptionId),
          subApi.getEntitlements(subscriptionId),
        ]);
        return { subscription, entitlements };
      }}
      onManagePlan={() => navigation.navigate("UpgradeDowngrade", { subscriptionId })}
      onCancel={() => navigation.navigate("Cancellation", { subscriptionId })}
      onViewInvoices={() => navigation.navigate("Invoices", { subscriptionId })}
    />
  );
}

function UpgradeDowngradeContainer({ navigation, route }: any) {
  const { subscriptionId, targetPlan } = route.params;
  const operationKeys = useRef<Record<string, string>>({});
  const [currentPlan, setCurrentPlan] = useState<{ id: string; name: string; priceCentavos: number; billingInterval: string; lockInMonths: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    subApi
      .getSubscription(subscriptionId)
      .then((s) => setCurrentPlan(s.plan))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your plan"));
  }, [subscriptionId]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg }}>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted, textAlign: "center" }]}>{error}</Text>
      </View>
    );
  }
  if (!currentPlan) return <Skeleton.Screen cards={3} />;

  return (
    <UpgradeDowngradeScreen
      currentPlan={currentPlan}
      targetPlan={targetPlan}
      onCheckoutInvoice={(invoiceId) => navigation.replace("InvoiceDetail", { invoiceId })}
      fetchPlans={subApi.listPlans}
      onUpgrade={(planId: string) => {
        const key = operationKeys.current[planId] ?? (operationKeys.current[planId] = newIdempotencyKey());
        return subApi.upgrade(subscriptionId, planId, key);
      }}
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

function InvoicesContainer({ navigation, route }: any) {
  const subscriptionId = route.params?.subscriptionId;
  const fetchInvoices = useCallback(async () => {
    const invoices = await subApi.listInvoices();
    return subscriptionId ? invoices.filter(invoice => invoice.subscriptionId === subscriptionId) : invoices;
  }, [subscriptionId]);
  return <InvoicesScreen navigation={navigation} fetchInvoices={fetchInvoices}
    onSelectInvoice={(invoice) => navigation.navigate(invoice.subscriptionId === null ? "ServiceBill" : "InvoiceDetail", { invoiceId: invoice.id })} />;
}

function InvoiceDetailContainer({ navigation, route }: any) {
  const invoiceId = route.params.invoiceId ?? route.params.invoice?.id;
  return <InvoicePaymentScreen key={`${invoiceId}:${route.params.outcome ?? ""}`} invoiceId={invoiceId} returnOutcome={route.params.outcome} fetchInvoice={subApi.getInvoice}
    createPaymentIntent={subApi.createPaymentIntent} navigation={navigation}
    openCheckout={openCheckout}
    onDownloadReceipt={async () => {
      const { url } = await subApi.getInvoicePdf(invoiceId);
      await WebBrowser.openBrowserAsync(url);
    }} onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("HomeTabsScreen")} />;
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

  const screenOptions = useScreenOptions();

  if (vehicles === null) {
    // Rendered before the Navigator mounts, so screenOptions cannot reach it.
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.chassis }}>
        <Skeleton.Screen cards={3} />
      </SafeAreaView>
    );
  }

  return (
    <ReadyContext.Provider value={{ vehicles, refreshVehicles, firstName, setBootState }}>
    <Stack.Navigator screenOptions={screenOptions}
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
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsContainer} />
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
      <Stack.Screen name="VehicleHealthDiagram" component={VehicleHealthDiagramContainer} />
      <Stack.Screen name="CategoryBreakdown" component={CategoryBreakdownContainer} />
      <Stack.Screen name="ScoreHistory" component={ScoreHistoryContainer} />
      <Stack.Screen name="ShareCertificate" component={ShareCertificateContainer} />
      <Stack.Screen name="ApprovalRequest" component={ApprovalRequestContainer} />
      <Stack.Screen name="Recommendations" component={RecommendationsContainer} />
      <Stack.Screen name="ServiceHistory2" component={ServiceHistoryContainer} />
      <Stack.Screen name="InspectionHistory" component={InspectionHistoryRoute} />
      <Stack.Screen name="InspectionReport" component={InspectionReportRoute} />
      <Stack.Screen name="RepairProgress" component={RepairProgressRoute} />
      <Stack.Screen name="ServiceBill" component={ServiceBillRoute} />
      <Stack.Screen name="Attention" component={AttentionContainer} />
      <Stack.Screen name="Announcements" component={AnnouncementsContainer} />
      <Stack.Screen name="Roadside">
        {({ route, navigation }: any) => (
          <RoadsideContainer vehicleId={route.params?.vehicleId} onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
    </ReadyContext.Provider>
  );
}

export function RootNavigator() {
  const screenOptions = useScreenOptions();
  const [state, setState] = useState<BootState | "PENDING">("PENDING");

  useEffect(() => {
    bootstrap().then(setState);
  }, []);

  if (state === "PENDING") return <Splash />;

  if (state === "READY") {
    return (
      <NavigationContainer linking={{ prefixes: [Linking.createURL("/")], config: { screens: { InvoiceDetail: "payment-result" } } }}>
        <ReadyStack setBootState={setState} />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
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
