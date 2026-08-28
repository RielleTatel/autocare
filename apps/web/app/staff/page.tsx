import Link from "next/link";
import { Button } from "../../components/Button";

export default function StaffPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <p className="text-ink text-lg">Advisor console</p>
      <nav className="flex gap-3">
        <Link href="/staff/schedule"><Button>Schedule board</Button></Link>
        <Link href="/staff/config"><Button variant="secondary">Capacity settings</Button></Link>
      </nav>
    </div>
  );
}
