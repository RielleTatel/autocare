import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { theme } from "../../theme";
import { ServiceTypeScreen } from "./ServiceTypeScreen";
import { SlotPickerScreen } from "./SlotPickerScreen";
import { ConfirmScreen } from "./ConfirmScreen";
import type { BookingApi, BookingServiceType, Slot } from "./bookingApi";
import type { EntitlementSummary } from "@autocare/contracts";

const HOLD_SECONDS = 600;
const manilaDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/**
 * Orchestrates the member booking flow (M-19 → M-22) as a single screen with internal steps:
 * service → slot (acquires a 10-min hold with a live countdown) → confirm (books, consuming an
 * entitlement when applicable). The hold auto-expires; on lapse the slot step prompts a re-pick.
 */
export function BookingContainer({
  api,
  vehicleId,
  vehicle,
  subscriptionId,
  onBooked,
}: {
  api: BookingApi;
  vehicleId: string;
  /** Shown on the time picker so the choice keeps its subject in view. */
  vehicle?: { plateNo: string; year: number; make: string; model: string } | null;
  subscriptionId: string | null;
  onBooked: () => void;
}) {
  const [step, setStep] = useState<"service" | "slot" | "confirm">("service");
  const [serviceTypes, setServiceTypes] = useState<BookingServiceType[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementSummary[]>([]);
  const [service, setService] = useState<BookingServiceType | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.listServiceTypes().then(setServiceTypes).catch((e) => setError(e.message));
    if (subscriptionId) api.getEntitlements(subscriptionId).then(setEntitlements).catch(() => {});
  }, [api, subscriptionId]);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => () => stopTimer(), []);

  const loadSlots = useCallback(
    async (s: BookingServiceType) => {
      setLoadingSlots(true);
      setError(null);
      try {
        const from = manilaDate(new Date());
        const to = manilaDate(new Date(Date.now() + 14 * 86_400_000));
        setSlots(await api.getSlots(from, to, s.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load times");
      } finally {
        setLoadingSlots(false);
      }
    },
    [api],
  );

  async function onSelectService(s: BookingServiceType) {
    setService(s);
    setStep("slot");
    await loadSlots(s);
  }

  async function onPickSlot(picked: Slot) {
    if (!service) return;
    setError(null);
    try {
      const { holdId: id } = await api.hold(picked.bayId, picked.start, service.id);
      setSlot(picked);
      setHoldId(id);
      setHoldSecondsLeft(HOLD_SECONDS);
      stopTimer();
      timer.current = setInterval(() => {
        setHoldSecondsLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            stopTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That slot was just taken. Pick another.");
      await loadSlots(service);
    }
  }

  async function onConfirm() {
    if (!holdId || !service) return;
    if (holdSecondsLeft === 0) {
      backToSlots();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.book(holdId, vehicleId, service.id, false);
      stopTimer();
      onBooked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
      setSubmitting(false);
    }
  }

  /** Back to the service step. Clears the loaded window so returning with a
   *  different service can't show the previous one's times. */
  const backToService = () => {
    setSlots([]);
    setService(null);
    setError(null);
    setStep("service");
  };

  const backToSlots = () => {
    stopTimer();
    setHoldId(null);
    setHoldSecondsLeft(null);
    setSlot(null);
    setStep("slot");
    if (service) void loadSlots(service);
  };

  const entitlementLine = (): string | null => {
    if (!service?.entitlementType) return null;
    const e = entitlements.find((x) => x.entitlementType === service.entitlementType);
    if (!e || e.remaining <= 0) return null;
    return `Uses 1 of ${e.quantityPerCycle} ${service.entitlementType.toLowerCase().replace("_", " ")} this cycle`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis }}>
      {error && (
        <Text testID="booking-error" style={[theme.text("label"), { color: theme.colors.danger, padding: theme.spacing.md }]}>
          {error}
        </Text>
      )}
      {step === "service" && <ServiceTypeScreen serviceTypes={serviceTypes} entitlements={entitlements} plateNo={vehicle?.plateNo} onSelect={onSelectService} />}
      {step === "slot" && (
        <SlotPickerScreen slots={slots} loading={loadingSlots} holdSecondsLeft={null} vehicle={vehicle} serviceName={service?.name} onPick={onPickSlot} onRepick={() => service && loadSlots(service)} onBack={backToService} />
      )}
      {step === "confirm" && slot && service && (
        holdSecondsLeft === 0 ? (
          <SlotPickerScreen slots={slots} holdSecondsLeft={0} heldSlotKey={`${slot.bayId}|${slot.start}`} vehicle={vehicle} serviceName={service.name} onPick={onPickSlot} onRepick={backToSlots} />
        ) : (
          <ConfirmScreen serviceName={service.name} slotStart={slot.start} entitlementLine={entitlementLine()} submitting={submitting} onConfirm={onConfirm} />
        )
      )}
    </View>
  );
}
