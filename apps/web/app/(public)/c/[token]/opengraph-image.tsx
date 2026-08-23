import { ImageResponse } from "next/og";
import { fetchPublicCertificate, bandInfo } from "../../../../lib/certificates/public";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social-preview card: big score numeral in band color on primary-deep. */
export default async function OgImage({ params }: { params: { token: string } }) {
  const result = await fetchPublicCertificate(params.token);
  const ok = result.state === "ok" ? result.cert : null;
  const info = bandInfo(ok?.band ?? "CRITICAL");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0A2E4F", color: "#FFFFFF", padding: 64, justifyContent: "space-between" }}>
        <div style={{ fontSize: 40, fontWeight: 600 }}>AutoCare+ Vehicle Health Certificate</div>
        {ok ? (
          <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
            <div style={{ fontSize: 260, fontWeight: 800, color: info.fill, lineHeight: 1 }}>{ok.score}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 64, fontWeight: 700 }}>{info.labelEn}</div>
              <div style={{ fontSize: 40, opacity: 0.8, fontFamily: "monospace" }}>{ok.plateNo}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 64, fontWeight: 700 }}>Certificate unavailable</div>
        )}
        <div style={{ fontSize: 32, opacity: 0.8 }}>
          {ok ? `Inspected ${new Date(ok.inspectionDate).toLocaleDateString()}` : "autocare.example/verify"}
        </div>
      </div>
    ),
    { ...size },
  );
}
