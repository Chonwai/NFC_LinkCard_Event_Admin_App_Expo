import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { copy } from "@/constants/copy.zh-TW";
import {
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import {
  NfcFlowError,
  isNfcSupported,
  readTagUid,
  startNfc,
} from "@/utils/nfc-utils";

const COPY_FEEDBACK_MS = 1600;

function readBlockedMessage(): string | null {
  if (Platform.OS === "web") return copy.nfc.webReadNotSupported;
  return null;
}

export default function NfcReadScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const blocked = readBlockedMessage();

  const [reading, setReading] = useState(false);
  const [tagUid, setTagUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, []);

  const handleCopy = useCallback((value: string) => {
    void Clipboard.setStringAsync(value).then(() => {
      setCopied(true);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => {
        setCopied(false);
        copyResetTimer.current = null;
      }, COPY_FEEDBACK_MS);
    });
  }, []);

  const handleRead = useCallback(async () => {
    if (blocked) {
      setError(blocked);
      return;
    }

    setReading(true);
    setError(null);
    setTagUid(null);
    setCopied(false);

    try {
      const supported = await isNfcSupported();
      if (!supported) {
        setError(
          Platform.OS === "ios"
            ? copy.nfc.iosReadHint
            : copy.nfc.webReadNotSupported,
        );
        return;
      }
      await startNfc();
      const uid = await readTagUid();
      setTagUid(uid);
    } catch (err) {
      if (err instanceof NfcFlowError && err.kind === "invalid-uid") {
        setError(copy.nfc.invalidTagUid);
      } else if (err instanceof NfcFlowError && err.kind === "unsupported") {
        setError(copy.nfc.webReadNotSupported);
      } else {
        setError(copy.nfc.readFailed);
      }
    } finally {
      setReading(false);
    }
  }, [blocked]);

  if (!eventId) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader
          title={copy.nfc.readTitle}
          leading="back"
          backFallbackPath="/(auth)/home"
        />
        <View style={styles.emptyBody}>
          <EmptyState
            kind="no-results"
            headingLevel={2}
            title={copy.event.unavailableTitle}
            description={copy.event.unavailableHint}
            testID="nfc-read-empty"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={copy.nfc.readTitle}
        leading="back"
        backFallbackPath="/(auth)/[eventId]/overview"
      />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.safeFooter },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {blocked ? (
          <InlineBanner
            compact
            tone="warning"
            message={blocked}
            testID="nfc-read-unsupported"
          />
        ) : null}

        {error ? <InlineBanner compact tone="danger" message={error} /> : null}

        <Text
          style={styles.hint}
          maxFontSizeMultiplier={layout.maxFontScaleBody}
        >
          {copy.nfc.readHint}
        </Text>

        {reading ? (
          <View style={styles.centerBox} testID="nfc-read-loading">
            <ActivityIndicator size="large" color={semantic.icon.brand} />
            <Text style={styles.loadingText}>{copy.nfc.reading}</Text>
          </View>
        ) : null}

        {tagUid != null && !reading ? (
          <View style={styles.resultCard} testID="nfc-read-result">
            <Text
              style={styles.resultTitle}
              maxFontSizeMultiplier={layout.maxFontScaleFixed}
            >
              {copy.nfc.readSuccess}
            </Text>
            <Pressable
              onPress={() => {
                handleCopy(tagUid);
              }}
              style={styles.tagUidRow}
              accessibilityRole="button"
              accessibilityLabel={
                copied
                  ? copy.nfc.tagUidCopied
                  : `${copy.nfc.copyTagUid} ${tagUid}`
              }
              hitSlop={6}
            >
              <Text
                style={styles.tagUidText}
                numberOfLines={1}
                maxFontSizeMultiplier={layout.maxFontScaleBody}
              >
                <Text style={styles.tagUidPrefix}>
                  {copy.nfc.tagUidLabel}：
                </Text>
                {tagUid}
              </Text>
              <Icon
                name={copied ? "check" : "copy"}
                size="sm"
                color={
                  copied ? semantic.status.success.fg : semantic.icon.muted
                }
              />
            </Pressable>
          </View>
        ) : null}

        <Button
          label={
            reading
              ? copy.nfc.reading
              : tagUid != null
                ? copy.nfc.readAgain
                : copy.nfc.startRead
          }
          onPress={() => void handleRead()}
          loading={reading}
          disabled={blocked != null || reading}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: space[4],
    gap: space[4],
  },
  emptyBody: {
    flex: 1,
    padding: spacing.screen,
    justifyContent: "center",
  },
  hint: {
    ...type.body,
    color: semantic.text.secondary,
  },
  centerBox: {
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[6],
  },
  loadingText: {
    ...type.body,
    color: semantic.text.muted,
  },
  resultCard: {
    backgroundColor: semantic.bg.brandSoft,
    borderRadius: radius.md,
    padding: space[4],
    gap: space[3],
    borderWidth: 1.5,
    borderColor: semantic.border.interactiveSelected,
  },
  resultTitle: {
    ...type.label,
    color: semantic.action.primary,
  },
  tagUidRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: space[1],
  },
  tagUidText: {
    ...type.monoSm,
    color: semantic.text.primary,
    flexShrink: 1,
  },
  tagUidPrefix: {
    ...type.caption,
    color: semantic.text.secondary,
    fontFamily: type.body.fontFamily,
  },
});
