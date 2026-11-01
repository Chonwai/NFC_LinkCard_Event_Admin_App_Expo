import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { copy } from "@/constants/copy.zh-TW";
import { layout, radius, semantic, space, type } from "@/constants/theme";
import { exhibitorService } from "@/services/exhibitor.service";
import {
  EXHIBITOR_LIST_MAX_LIMIT,
  type Exhibitor,
} from "@/types/exhibitor.types";
import {
  EXHIBITOR_STATUSES,
  mergeExhibitorBuckets,
  type ExhibitorBucket,
} from "@/utils/exhibitor-list";

/** 被選中的展商（畫面只需要 id 與名稱）。 */
export interface ClaimExhibitor {
  id: string;
  name: string;
}

export interface ClaimBadgesDialogProps {
  /** 哪個活動的展商（dialog 本身拿不到 route params）。 */
  eventId: string;
  /** 要指派的 badge 數量（顯示用；實際 id 由呼叫端持有）。 */
  badgeCount: number;
  busy: boolean;
  onSubmit: (exhibitor: ClaimExhibitor) => void;
  onCancel: () => void;
}

/**
 * 指派 badge 給展商的**選人**畫面。
 *
 * ## 為什麼展商清單要打四次
 *
 * Web 的 `openClaimModal` 呼叫
 * `listAllExhibitorsAdmin(eventId, { page: 1, limit: 100 })`，**沒有帶 `status`**。
 * 後端 `ExhibitorService` 在 `status` 缺席時會**強制**當成 `ACTIVE`
 * （`ExhibitorService.ts:219-222`），於是 Web 那一行的註解「含非 ACTIVE」
 * 其實是錯的：待審批（`PENDING_APPROVAL`）與已完成（`COMPLETED`）的展商
 * 一筆都不會出現，而那些正是需要被指派手環的對象（報到當天還在待審的攤位
 * 也得發手環）。
 *
 * 這是「照抄 Web 會造成資料遺失」：不是看不到資料，是**選不到人**，於是
 * 操作員只能放棄或去 Web 補做。所以這裡沿用 App 既有、且已被測試釘住的
 * 做法——四個狀態各打一次再合併（`utils/exhibitor-list.ts`）。
 *
 * ## 為什麼多一個搜尋框（Web 沒有）
 *
 * Web 用的是原生 `<select>`，瀏覽器自帶型別搜尋。行動裝置的清單沒有那個
 * 能力，上百家廠商只能用捲的——這是**平台等價物**，不是多做的功能：
 * 它只過濾已經載入的清單，沒有多打任何請求。
 */
export function ClaimBadgesDialog({
  eventId,
  badgeCount,
  busy,
  onSubmit,
  onCancel,
}: ClaimBadgesDialogProps) {
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClaimExhibitor | null>(null);

  /**
   * 載入展商。與 `exhibitors.tsx` 完全相同的四狀態合併（見檔頭），
   * 不另外發明一套查詢。
   */
  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadFailed(false);
      try {
        const buckets: ExhibitorBucket[] = await Promise.all(
          EXHIBITOR_STATUSES.map(async (status) => {
            const res = await exhibitorService.listExhibitors(eventId, {
              status,
              limit: EXHIBITOR_LIST_MAX_LIMIT,
            });
            return {
              status,
              exhibitors: res.exhibitors,
              total: res.pagination.total,
            };
          }),
        );
        if (!active) return;
        setExhibitors(mergeExhibitorBuckets(buckets).all);
      } catch {
        if (!active) return;
        setLoadFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [eventId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return exhibitors;
    return exhibitors.filter((exhibitor) =>
      exhibitor.companyName.toLowerCase().includes(needle),
    );
  }, [exhibitors, query]);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog} testID="badges-claim">
          <Text
            style={styles.title}
            maxFontSizeMultiplier={layout.maxFontScaleFixed}
          >
            {copy.badges.claimTitle}
          </Text>
          <Text
            style={styles.intro}
            maxFontSizeMultiplier={layout.maxFontScaleBody}
          >
            {copy.badges.claimIntro(badgeCount)}
          </Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={copy.badges.claimSearchPlaceholder}
            placeholderTextColor={semantic.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
            accessibilityLabel={copy.badges.claimSearchPlaceholder}
            testID="badges-claim-search"
          />

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={semantic.icon.brand} />
            </View>
          ) : loadFailed ? (
            <Text
              style={styles.error}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.badges.claimExhibitorsLoadFailed}
            </Text>
          ) : filtered.length === 0 ? (
            <Text
              style={styles.muted}
              maxFontSizeMultiplier={layout.maxFontScaleBody}
            >
              {copy.badges.claimExhibitorsEmpty}
            </Text>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {filtered.map((exhibitor) => {
                const isSelected = selected?.id === exhibitor.id;
                return (
                  <Pressable
                    key={exhibitor.id}
                    onPress={() =>
                      setSelected({
                        id: exhibitor.id,
                        name: exhibitor.companyName,
                      })
                    }
                    style={[styles.row, isSelected && styles.rowSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={exhibitor.companyName}
                    testID={`badges-claim-exhibitor-${exhibitor.id}`}
                  >
                    <Text
                      style={styles.rowText}
                      numberOfLines={1}
                      maxFontSizeMultiplier={layout.maxFontScaleBody}
                    >
                      {exhibitor.companyName}
                    </Text>
                    {exhibitor.boothNumber ? (
                      <Text
                        style={styles.rowMeta}
                        maxFontSizeMultiplier={layout.maxFontScaleBody}
                      >
                        {exhibitor.boothNumber}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Button
            label={copy.badges.claimNext}
            onPress={() => {
              if (selected) onSubmit(selected);
            }}
            disabled={busy || !selected}
            testID="badges-claim-next"
          />
          <Button
            label={copy.common.cancel}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            testID="badges-claim-cancel"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: space[4],
  },
  dialog: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
    maxHeight: "85%",
  },
  title: { ...type.h3, color: semantic.text.primary },
  intro: { ...type.caption, color: semantic.text.secondary },
  search: {
    backgroundColor: semantic.bg.canvas,
    borderWidth: 1,
    borderColor: semantic.border.interactive,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    color: semantic.text.primary,
    minHeight: layout.buttonHeight,
  },
  center: { paddingVertical: space[4], alignItems: "center" },
  muted: { ...type.caption, color: semantic.text.muted },
  error: { ...type.caption, color: semantic.status.danger.fg },
  list: { flexGrow: 0, maxHeight: 320 },
  listContent: { gap: space[1] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.border.decorative,
    backgroundColor: semantic.bg.canvas,
  },
  rowSelected: {
    borderColor: semantic.border.interactiveSelected,
    backgroundColor: semantic.bg.brandSoft,
  },
  rowText: { ...type.body, color: semantic.text.primary, flex: 1, minWidth: 0 },
  rowMeta: { ...type.caption, color: semantic.text.muted, flexShrink: 0 },
});
