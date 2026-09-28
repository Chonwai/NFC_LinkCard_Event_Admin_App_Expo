import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldInput } from "@/components/ui/FieldInput";
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import { radius, semantic, space, spacing, type } from "@/constants/theme";
import { eventService } from "@/services/event.service";
import { registrationService } from "@/services/registration.service";
import type { TicketTypeItem } from "@/types/api.types";
import { mapWalkInError } from "@/utils/walk-in-error-map";
import { buildWalkInRegistrationBody } from "@/utils/walk-in-payload";
import { validateWalkInConsent } from "@/utils/walk-in-validation";

export default function WalkInScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [tickets, setTickets] = useState<TicketTypeItem[]>([]);
  const [ticketId, setTicketId] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [consent, setConsent] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    code: string;
    needsPayment: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!eventId) return;
      setLoadingTickets(true);
      try {
        const res = await eventService.listTicketTypes(eventId);
        if (!active) return;
        const visible = (res.ticketTypes ?? []).filter(
          (item) => !item.isHidden,
        );
        setTickets(visible);
        setTicketId(visible[0]?.id ?? "");
      } catch {
        if (!active) return;
        setError(copy.checkIn.walkInFailed);
      } finally {
        if (active) setLoadingTickets(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [eventId]);

  async function submit() {
    if (!eventId) return;
    const gate = validateWalkInConsent({ ticketId, email, consent });
    if (!gate.ok) {
      setError(copy.checkIn[gate.key]);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await registrationService.createRegistration(
        eventId,
        buildWalkInRegistrationBody({
          ticketId,
          email,
          firstName,
          lastName,
          phone,
          company,
        }),
      );
      const reg = result.registration;
      setCreated({
        id: reg.id,
        code: reg.registrationCode,
        needsPayment:
          Boolean(reg.stripeCheckoutUrl) || reg.status === "PENDING_PAYMENT",
      });
      setConsent(false);
    } catch (err) {
      setError(mapWalkInError(err, copy.checkIn.walkInFailed));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.checkIn.walkInTitle}
        leading="back"
        backFallbackPath="/(auth)/home"
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + spacing.safeFooter },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <InlineBanner compact tone="danger" message={error} />
          ) : null}
          {created ? (
            <View style={styles.success} testID="walk-in-success">
              <Text style={type.h2}>{copy.checkIn.walkInSuccess}</Text>
              <Text style={type.body}>{created.code}</Text>
              {created.needsPayment ? (
                <InlineBanner
                  compact
                  tone="warning"
                  message={copy.checkIn.walkInPaymentNote}
                />
              ) : null}
              <Button
                label={copy.checkIn.walkInGoCheckIn}
                onPress={() => {
                  router.replace({
                    pathname: "/(auth)/[eventId]/check-in",
                    params: { eventId: eventId ?? "" },
                  });
                }}
              />
              <Button
                label={copy.checkIn.walkInGoNfc}
                variant="secondary"
                onPress={() => {
                  router.replace({
                    pathname: "/(auth)/[eventId]/nfc-bind",
                    params: { eventId: eventId ?? "" },
                  });
                }}
              />
            </View>
          ) : loadingTickets ? (
            <Text style={[type.body, styles.muted]}>
              {copy.checkIn.checking}
            </Text>
          ) : tickets.length === 0 ? (
            <EmptyState
              kind="no-results"
              headingLevel={2}
              title={copy.checkIn.walkInNoTickets}
              description={copy.checkIn.walkInNeedTicket}
            />
          ) : (
            <>
              <Text style={type.label}>{copy.checkIn.walkInTicket}</Text>
              <View style={styles.tickets}>
                {tickets.map((ticket) => {
                  const label = ticket.displayName || ticket.name || ticket.id;
                  const on = ticket.id === ticketId;
                  return (
                    <Pressable
                      key={ticket.id}
                      onPress={() => setTicketId(ticket.id)}
                      style={[styles.ticket, on && styles.ticketOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={type.label}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <FieldInput
                label={copy.checkIn.walkInEmail}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                required
              />
              <FieldInput
                label={copy.checkIn.walkInFirstName}
                value={firstName}
                onChangeText={setFirstName}
              />
              <FieldInput
                label={copy.checkIn.walkInLastName}
                value={lastName}
                onChangeText={setLastName}
              />
              <FieldInput
                label={copy.checkIn.walkInPhone}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <FieldInput
                label={copy.checkIn.walkInCompany}
                value={company}
                onChangeText={setCompany}
              />
              <Pressable
                onPress={() => setConsent((v) => !v)}
                style={styles.consentRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                testID="walk-in-consent"
              >
                <View style={[styles.checkbox, consent && styles.checkboxOn]}>
                  {consent ? (
                    <Icon
                      name="check"
                      size={14}
                      color={semantic.action.onPrimary}
                    />
                  ) : null}
                </View>
                <Text style={[type.body, styles.consentLabel]}>
                  {copy.checkIn.walkInConsentLabel}
                </Text>
              </Pressable>
              <Button
                label={copy.checkIn.walkInSubmit}
                loading={submitting}
                onPress={() => void submit()}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  flex: { flex: 1 },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: space[3],
    gap: space[3],
  },
  muted: { color: semantic.text.muted },
  tickets: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  ticket: {
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    backgroundColor: semantic.bg.surface,
  },
  ticketOn: {
    borderColor: semantic.border.interactiveSelected,
    backgroundColor: semantic.bg.brandSoft,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[2],
    paddingVertical: space[1],
  },
  consentLabel: {
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: semantic.border.interactive,
    borderRadius: 4,
    marginTop: 1,
    backgroundColor: semantic.bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    borderColor: semantic.action.primary,
    backgroundColor: semantic.action.primary,
  },
  success: { gap: spacing.gap },
});
