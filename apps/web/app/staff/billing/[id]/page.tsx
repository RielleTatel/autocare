import { cookies } from "next/headers";
import { openSession } from "../../../../lib/auth/session";
import { BillDetail } from "./BillDetail";

export default async function BillPage({ params }: { params: { id: string } }) {
  const cookie = cookies().get("ac_session")?.value;
  const session = cookie ? await openSession(cookie) : null;
  return <BillDetail id={params.id} collectorId={session?.uid ?? ""} />;
}
