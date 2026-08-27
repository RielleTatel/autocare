import { useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Plate } from "../../components/Plate";
import type { CertificateVisibility, CreatedCertificate } from "./healthScoreApi";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://autocare.example";

export interface ShareCertificateScreenProps {
  createCertificate: () => Promise<CreatedCertificate>;
  setVisibility: (certId: string, visibility: CertificateVisibility) => Promise<unknown>;
  share?: (url: string) => Promise<void>;
}

/** M-16 — generate a certificate, share the link, control visibility, revoke.
 *  A fresh certificate starts PRIVATE; sharing flips it to LINK. */
export function ShareCertificateScreen({ createCertificate, setVisibility, share }: ShareCertificateScreenProps) {
  const t = theme;
  const [cert, setCert] = useState<CreatedCertificate | null>(null);
  const [visibility, setVis] = useState<CertificateVisibility>("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const url = cert ? `${WEB_URL}/c/${cert.publicToken}` : "";

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const generate = () =>
    guard(async () => {
      const c = await createCertificate();
      setCert(c);
      setVis("PRIVATE");
    });

  const doShare = () =>
    guard(async () => {
      if (!cert) return;
      if (visibility !== "LINK") {
        await setVisibility(cert.id, "LINK");
        setVis("LINK");
      }
      const link = `${WEB_URL}/c/${cert.publicToken}`;
      if (share) await share(link);
      else await Share.share({ message: `Check my vehicle's health certificate: ${link}`, url: link });
    });

  const setVisibilityTo = (v: CertificateVisibility) =>
    guard(async () => {
      if (!cert) return;
      await setVisibility(cert.id, v);
      setVis(v);
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis, padding: t.spacing.md, gap: t.spacing.md }}>
      <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Share certificate</Text>
      {error && <Text style={{ ...t.text("body"), color: t.colors.danger }}>{error}</Text>}

      {!cert ? (
        <Button block accessibilityLabel="Generate certificate" disabled={busy} onPress={generate}>
          Generate a shareable certificate
        </Button>
      ) : (
        <>
          <Card style={{ gap: t.spacing.xs }}>
            <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>Verification code</Text>
            {/* A verification code is machine identity, same class as a plate. */}
            <Plate variant="plain" style={{ fontSize: 22 }}>{cert.verificationCode}</Plate>
            {visibility === "LINK" && <Text accessibilityLabel="Share link" style={{ ...t.text("label"), color: t.colors.inkMuted }} numberOfLines={1}>{url}</Text>}
          </Card>

          <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>Visibility</Text>
          <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
            {(["PRIVATE", "LINK"] as const).map((v) => (
              <Pressable
                key={v}
                accessibilityRole="button"
                accessibilityLabel={v === "PRIVATE" ? "Private" : "Anyone with link"}
                accessibilityState={{ selected: visibility === v }}
                disabled={busy}
                onPress={() => setVisibilityTo(v)}
                style={{ flex: 1, minHeight: t.minTarget, borderRadius: t.radii.md, alignItems: "center", justifyContent: "center", backgroundColor: visibility === v ? t.colors.primary : t.colors.surface, borderWidth: 1, borderColor: t.colors.line }}
              >
                <Text style={{ ...t.text("body"), color: visibility === v ? t.colors.onPrimary : t.colors.ink }}>{v === "PRIVATE" ? "Private" : "Anyone with link"}</Text>
              </Pressable>
            ))}
          </View>

          <Button block icon="share-2" accessibilityLabel="Share link" disabled={busy} onPress={doShare}>
            Share link
          </Button>

          {visibility !== "REVOKED" && (
            confirmRevoke ? (
              <Card accent={t.colors.danger} style={{ gap: t.spacing.sm }}>
                <Text style={{ ...t.text("body"), color: t.colors.ink }}>
                  Revoking stops all shared links immediately. Anyone who opens the link will see a "no longer available" notice. Continue?
                </Text>
                <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button block variant="ghost" onPress={() => setConfirmRevoke(false)}>Cancel</Button>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button block variant="danger" accessibilityLabel="Confirm revoke" onPress={() => { setConfirmRevoke(false); void setVisibilityTo("REVOKED"); }}>
                      Revoke
                    </Button>
                  </View>
                </View>
              </Card>
            ) : (
              <Button block variant="ghost" accessibilityLabel="Revoke certificate" disabled={busy} onPress={() => setConfirmRevoke(true)}>
                Revoke certificate
              </Button>
            )
          )}
          {visibility === "REVOKED" && <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>Revoked — shared links no longer work.</Text>}
        </>
      )}
    </View>
  );
}
