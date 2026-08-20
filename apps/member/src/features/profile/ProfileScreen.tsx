import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";
import { profileUpdateSchema, ProfileUpdate } from "@autocare/contracts";

export interface ProfileFormState {
  name: string; email: string; address: string; emergencyContactName: string; emergencyContactMobile: string;
}

function fieldsFromProfile(p: Partial<ProfileFormState> | null): ProfileFormState {
  return { name: p?.name ?? "", email: p?.email ?? "", address: p?.address ?? "",
    emergencyContactName: p?.emergencyContactName ?? "", emergencyContactMobile: p?.emergencyContactMobile ?? "" };
}

export function ProfileScreen({ initialProfile, saveProfile, onSignOut, onPrivacy }: {
  initialProfile: Partial<ProfileFormState> | null;
  saveProfile: (data: ProfileUpdate) => Promise<unknown>;
  onSignOut: () => void;
  onPrivacy: () => void;
}) {
  const [form, setForm] = useState<ProfileFormState>(fieldsFromProfile(initialProfile));
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFormState, string>>>({});
  const [saved, setSaved] = useState(false);
  const set = (k: keyof ProfileFormState) => (v: string) => { setSaved(false); setForm((f) => ({ ...f, [k]: v })); };

  // `initialProfile` typically starts null and the real GET /users/me resolves
  // after mount — seed the form the first time it transitions null → loaded.
  // Guarded to fire once so it never clobbers in-progress edits on later re-renders.
  const seededRef = useRef(initialProfile != null);
  useEffect(() => {
    if (!seededRef.current && initialProfile != null) {
      seededRef.current = true;
      setForm(fieldsFromProfile(initialProfile));
    }
  }, [initialProfile]);

  const save = async () => {
    const candidate = {
      name: form.name.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      emergencyContactName: form.emergencyContactName.trim() || undefined,
      emergencyContactMobile: form.emergencyContactMobile.trim() || undefined,
    };
    const parsed = profileUpdateSchema.safeParse(candidate);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    await saveProfile(parsed.data);
    setSaved(true);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Profile</Text>

      {([
        ["name", "Name"], ["email", "Email"], ["address", "Address"],
        ["emergencyContactName", "Emergency contact name"], ["emergencyContactMobile", "Emergency contact mobile"],
      ] as const).map(([key, label]) => (
        <View key={key}>
          <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.md }]}>{label}</Text>
          <TextInput testID={"field-" + key} value={form[key]} onChangeText={set(key)}
            style={[theme.text("body"), { backgroundColor: theme.colors.surface, borderRadius: theme.radii.sm,
              height: theme.minTarget, paddingHorizontal: theme.spacing.sm, borderWidth: 1,
              borderColor: errors[key] ? theme.colors.danger : theme.colors.line }]} />
          {errors[key] ? (
            <Text style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.xs }]}>{errors[key]}</Text>
          ) : null}
        </View>
      ))}

      <Pressable testID="save-profile" onPress={save}
        style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.lg,
          backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>Save</Text>
      </Pressable>
      {saved ? (
        <Text style={[theme.text("label"), { color: theme.colors.success, marginTop: theme.spacing.sm }]}>Saved</Text>
      ) : null}

      <Pressable testID="privacy-row" onPress={onPrivacy}
        style={{ height: theme.minTarget, justifyContent: "center", marginTop: theme.spacing.lg,
          borderTopWidth: 1, borderTopColor: theme.colors.line }}>
        <Text style={[theme.text("body"), { color: theme.colors.ink }]}>Privacy & data</Text>
      </Pressable>

      <Pressable testID="sign-out" onPress={onSignOut}
        style={{ height: theme.minTarget, justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.danger }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
