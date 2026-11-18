import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useIsFocused, type ParamListBase } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "@autocare/api-client";
import * as WebBrowser from "expo-web-browser";
import { api } from "../../shared/api";
import { makeHealthScoreApi } from "../health-score/healthScoreApi";
import { makeServiceHistoryApi } from "./serviceHistoryApi";
import { HistoryPage, InspectionHistoryScreen, InspectionReportScreen, RepairProgressScreen, ServiceDocumentScreen } from "./ServiceHistoryScreens";

const serviceHistoryApi = makeServiceHistoryApi(api);
const healthScoreApi = makeHealthScoreApi(api);
type ScreenProps = NativeStackScreenProps<ParamListBase>;
type VehicleParams = { vehicleId: string };
type ReportParams = VehicleParams & { inspectionId: string };
type RepairParams = VehicleParams & { workOrderId: string };
type DocumentParams = { invoiceId: string; vehicleId?: string };

/** Focus reloads the authoritative state; late reads cannot paint another record. */
function useOwnedRead<T>(key: string, read: () => Promise<T>) {
  const request = useRef(0);
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: string | null }>({ key, data: null, loading: true, error: null });
  const reload = useCallback(async () => {
    const generation = ++request.current;
    setState({ key, data: null, loading: true, error: null });
    try {
      const data = await read();
      if (generation === request.current) setState({ key, data, loading: false, error: null });
    } catch (error) {
      if (generation === request.current) setState({ key, data: null, loading: false, error: error instanceof Error ? error.message : "Your records could not be loaded. Please retry." });
    }
  }, [key, read]);
  useFocusEffect(useCallback(() => {
    void reload();
    return () => { request.current++; };
  }, [reload]));
  useEffect(() => () => { request.current++; }, [key]);
  return { ...(state.key === key ? state : { key, data: null, loading: true, error: null }), reload };
}

export function InspectionHistoryRoute({ navigation, route }: ScreenProps) {
  const { vehicleId } = route.params as VehicleParams;
  const read = useCallback(async () => {
    const [inspections, repairs, fullScore] = await Promise.all([
      serviceHistoryApi.listInspections(vehicleId),
      serviceHistoryApi.listRepairs(vehicleId),
      healthScoreApi.getScore(vehicleId).catch(error => {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }),
    ]);
    if (inspections.some(report => report.vehicleId !== vehicleId) || repairs.some(repair => repair.vehicleId !== vehicleId) || (fullScore && fullScore.vehicleId !== vehicleId)) {
      throw new Error("These records do not match this vehicle. Please retry.");
    }
    return { inspections, repairs, fullScore };
  }, [vehicleId]);
  const { data, loading, error, reload } = useOwnedRead(`history:${vehicleId}`, read);
  const openBill = (invoiceId: string) => navigation.navigate("ServiceBill", { invoiceId, vehicleId });
  return <HistoryPage title="Inspections & repairs" onBack={() => navigation.goBack()} onRefresh={reload} loading={loading} error={error}>
    {data && <InspectionHistoryScreen {...data}
      onOpenReport={inspectionId => navigation.navigate("InspectionReport", { vehicleId, inspectionId })}
      onOpenRepair={workOrderId => navigation.navigate("RepairProgress", { vehicleId, workOrderId })}
      onOpenHealth={() => navigation.navigate("HealthScore", { vehicleId })} onOpenBill={openBill} />}
  </HistoryPage>;
}

export function InspectionReportRoute({ navigation, route }: ScreenProps) {
  const { vehicleId, inspectionId } = route.params as ReportParams;
  const read = useCallback(async () => {
    const [report, allRepairs] = await Promise.all([serviceHistoryApi.getInspection(vehicleId, inspectionId), serviceHistoryApi.listRepairs(vehicleId)]);
    if (report.id !== inspectionId || report.vehicleId !== vehicleId || allRepairs.some(repair => repair.vehicleId !== vehicleId)) {
      throw new Error("The report does not match this vehicle. Please retry.");
    }
    return { report, repairs: allRepairs.filter(repair => repair.inspectionId === inspectionId) };
  }, [vehicleId, inspectionId]);
  const { data, loading, error, reload } = useOwnedRead(`report:${vehicleId}:${inspectionId}`, read);
  return <HistoryPage title="Original inspection report" onBack={() => navigation.goBack()} onRefresh={reload} loading={loading} error={error}>
    {data && <InspectionReportScreen {...data}
      onOpenRepair={workOrderId => navigation.navigate("RepairProgress", { vehicleId, workOrderId })}
      onOpenBill={invoiceId => navigation.navigate("ServiceBill", { vehicleId, invoiceId })} />}
  </HistoryPage>;
}

export function RepairProgressRoute({ navigation, route }: ScreenProps) {
  const { vehicleId, workOrderId } = route.params as RepairParams;
  const read = useCallback(async () => {
    const repairs = await serviceHistoryApi.listRepairs(vehicleId);
    if (repairs.some(repair => repair.vehicleId !== vehicleId)) throw new Error("The repair records do not match this vehicle. Please retry.");
    const repair = repairs.find(candidate => candidate.id === workOrderId);
    if (!repair) throw new Error("This repair is unavailable for this vehicle.");
    return repair;
  }, [vehicleId, workOrderId]);
  const { data, loading, error, reload } = useOwnedRead(`repair:${vehicleId}:${workOrderId}`, read);
  return <HistoryPage title="Repair progress" onBack={() => navigation.goBack()} onRefresh={reload} loading={loading} error={error}>
    {data && <RepairProgressScreen repair={data}
      onOpenReport={() => navigation.navigate("InspectionReport", { vehicleId, inspectionId: data.inspectionId })}
      onOpenBill={invoiceId => navigation.navigate("ServiceBill", { vehicleId, invoiceId })} />}
  </HistoryPage>;
}

export function ServiceBillRoute({ navigation, route }: ScreenProps) {
  const { invoiceId, vehicleId } = route.params as DocumentParams;
  const active = useIsFocused();
  const currentDocument = useRef({ invoiceId, vehicleId, active });
  currentDocument.current = { invoiceId, vehicleId, active };
  useEffect(() => () => { currentDocument.current.active = false; }, []);
  const read = useCallback(async () => {
    const document = await serviceHistoryApi.getDocument(invoiceId);
    if (document.id !== invoiceId || (vehicleId && document.vehicleId !== vehicleId)) {
      throw new Error("The final document does not match this job. Please retry.");
    }
    return document;
  }, [invoiceId, vehicleId]);
  const { data, loading, error, reload } = useOwnedRead(`bill:${vehicleId ?? "owned"}:${invoiceId}`, read);
  return <HistoryPage title="Final bill & receipt" onBack={() => navigation.goBack()} onRefresh={reload} loading={loading} error={error}>
    {data && <ServiceDocumentScreen document={data} onOpenDocument={async () => {
      const { url } = await serviceHistoryApi.getDocumentPdf(invoiceId);
      if (!currentDocument.current.active || currentDocument.current.invoiceId !== invoiceId || currentDocument.current.vehicleId !== vehicleId) return;
      await WebBrowser.openBrowserAsync(url);
    }} />}
  </HistoryPage>;
}
