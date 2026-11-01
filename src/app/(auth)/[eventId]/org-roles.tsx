import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { copy } from "@/constants/copy.zh-TW";
import {
  layout,
  radius,
  semantic,
  space,
  spacing,
  type,
} from "@/constants/theme";
import { eventService, type EventAccess } from "@/services/event.service";
import { orgRoleService } from "@/services/org-role.service";
import type { EventOrgRole } from "@/types/orgRole.types";
import {
  classifyOrgRoleError,
  formatOrgRoleEmail,
  formatOrgRolePerson,
  orgRoleLabel,
  orgRoleState,
} from "@/utils/org-role-display";

/**
 * 組織角色（parity `org-roles`）。
 *
 * 前端 counterpart：
 * `LinkCard_Frontend/app/(event)/manage/[eventId]/org-roles/page.tsx`。
 * 對齊原則：Web 做得到的事，App 也要做得到，不增不減。
 *
 * ## 這一頁給出與收回後台權限
 *
 * 邀請一個人＝讓他有能力管理這場活動的後台；移除＝把那個能力收走。兩者都是
 * **治理動作**，誤操作的成本不是「多一筆資料」，而是「後台多了一個不該有權限的
 * 人」。所以邀請與移除都走二次確認，且確認框要看得見「對誰、什麼角色」。
 *
 * ## 兩個不同的權限判斷，不能合成一個
 *
 * 後端對這一頁的四條路由用了**兩種**守門（`engagement.routes.ts:43-46` ＋
 * `EventEngagementController`）：
 *
 * | 動作 | 後端守門 | 誰可以 |
 * | --- | --- | --- |
 * | 看名單 | `getEventWriteAccess` | owner / SUPER_ADMIN / **COORDINATOR** |
 * | 邀請、移除 | `getEventSuperAdminAccess` | owner / SUPER_ADMIN |
 *
 * 所以一個 COORDINATOR **看得到**誰在管理這場活動，但**不能改**。畫面因此
 * 用兩個不同的旗標：名單能不能讀看 `loadError` 的 403，能不能改看
 * `my-access` 的 `canInviteAdmins`。拿 `canManage` 通吃會讓 COORDINATOR 看到
 * 一組按了會 403 的按鈕。
 *
 * ## `canInviteAdmins` 三態：`true` / `false` / `undefined`
 *
 * 與 Web 相同的處理（`org-roles/page.tsx:44-49`）：`undefined` 代表**問不到**
 * （`my-access` 失敗或舊版後端沒回這個欄位），此時**不要**把表單鎖死——
 * 真的沒權限的話，送出時後端仍會回 403，而畫面會把它講清楚。`false` 才是
 * 後端明確說「你不行」。
 *
 * 這個區別在手機上更重要：App 的 `my-access` 是與名單**並行**抓的
 * （`Promise.all`），它失敗不該讓一個有權限的人失去入口。
 *
 * ## 與 Web 的差異一：多顯示「狀態」
 *
 * Web 的清單只有「人名 / email / 角色徽章」三樣，**看不出這個人到底生效了
 * 沒有**。但後端對「email 還沒有帳號」的邀請會留下 `acceptedAt: null`
 * （`EventOrgRoleService.ts:75`），那種列與已生效的列在 Web 上長得一模一樣。
 *
 * App 因此多一個狀態徽章（`已生效` / `待接受`）與一行說明。這是**唯讀呈現**
 * 後端已經回傳的資料，沒有新增任何能力，也沒有多打任何請求。
 *
 * ## 與 Web 的差異二：`user` 為 `null` 時不會白屏
 *
 * Web 直接讀 `r.user.display_name ?? r.user.email`（`org-roles/page.tsx:281-284`），
 * 而 `user` 對「還沒註冊的 email」是真的 `null`（`schema.prisma:1260-1261`）
 * ——那一頁會拋 TypeError 整頁白掉。App 一律經
 * `utils/org-role-display.ts:formatOrgRolePerson()` 取值，`null` 時退回被邀請的
 * email。
 *
 * ## 為什麼重新整理走 `reloadKey`
 *
 * 與 `bank-transfers.tsx` / `polls.tsx` / `ticket-types.tsx` 同一個理由：標頭的
 * 重新整理鈕不能在 effect 外直接呼叫會 `setState` 的載入函式
 * （`react-hooks/set-state-in-effect`），所以把「重載」表達成「把 key 加一」。
 */
export default function EventOrgRolesScreen() {
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [roles, setRoles] = useState<EventOrgRole[]>([]);
  const [loading, setLoading] = useState(true);
  /** `null` ＝沒有錯誤。`forbidden` 與 `failed` 要分開講（見下方 render）。 */
  const [loadError, setLoadError] = useState<"forbidden" | "failed" | null>(
    null,
  );
  const [access, setAccess] = useState<EventAccess | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // 與 Web 一樣並行：`my-access` 失敗不能把名單一起弄掉
      // （`org-roles/page.tsx:66-84`）。
      const [rolesOutcome, accessResult] = await Promise.all([
        orgRoleService
          .list(eventId)
          .then((data) => ({ roles: data.orgRoles ?? [], error: null }))
          .catch((error: unknown) => ({ roles: null, error })),
        eventService.getMyAccess(eventId).catch(() => null),
      ]);

      if (cancelled) return;

      if (rolesOutcome.error != null) {
        const kind = classifyOrgRoleError(rolesOutcome.error).kind;
        setRoles([]);
        // 只有 403 是「你沒有權限」；其餘一律是「讀不到」。把 403 講成
        // 「載入失敗」會讓 COORDINATOR 以為是網路問題而一直重試。
        setLoadError(kind === "forbidden" ? "forbidden" : "failed");
      } else {
        setRoles(rolesOutcome.roles ?? []);
        setLoadError(null);
      }

      // 問不到就回到「未知」（`null`），不保留上一次的答案——否則一個剛剛被
      // 升權的人會一直被舊的 `false` 鎖住，直到整頁重開。
      setAccess(accessResult);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, reloadKey]);

  /** `false` 才是後端明確說「你不行」；`undefined` 不鎖。 */
  const gateDisabled = access?.canInviteAdmins === false;
  const myRole = access?.role ?? null;
  const showPermissionNotice =
    !loading && loadError == null && gateDisabled && myRole != null;
  const hasPending = roles.some((role) => orgRoleState(role) === "pending");

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={copy.orgRoles.title}
        subtitle={copy.orgRoles.subtitle}
        leading="back"
        onRefresh={() => setReloadKey((key) => key + 1)}
        isRefreshing={loading}
        testID="org-roles-header"
      />
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.screen },
        ]}
      >
        {myRole != null ? (
          <Text style={styles.myRole} testID="org-roles-my-role">
            {copy.orgRoles.yourRole}：
            {orgRoleLabel(myRole, copy.orgRoles.roleLabels)}
          </Text>
        ) : null}

        {/* 先講清楚限制，不要讓人送一個註定 403 的請求才發現。 */}
        {showPermissionNotice ? (
          <InlineBanner
            compact
            tone="warning"
            title={copy.orgRoles.noPermissionTitle}
            message={copy.orgRoles.noPermissionHint(
              orgRoleLabel(myRole, copy.orgRoles.roleLabels),
            )}
            testID="org-roles-permission-notice"
          />
        ) : null}

        {loadError === "failed" ? (
          <InlineBanner
            compact
            tone="danger"
            message={copy.orgRoles.loadFailed}
            actionLabel={copy.common.refresh}
            onAction={() => setReloadKey((key) => key + 1)}
          />
        ) : null}

        {loadError === "forbidden" ? (
          <InlineBanner
            compact
            tone="warning"
            title={copy.orgRoles.noPermissionTitle}
            message={copy.orgRoles.noPermissionHint(
              myRole == null
                ? "—"
                : orgRoleLabel(myRole, copy.orgRoles.roleLabels),
            )}
          />
        ) : null}

        {/* 「待接受」是什麼意思——只在真的有這種列時才佔畫面。 */}
        {!loading && loadError == null && hasPending ? (
          <InlineBanner
            compact
            tone="info"
            message={copy.orgRoles.pendingHint}
            testID="org-roles-pending-hint"
          />
        ) : null}

        <Text style={styles.sectionTitle}>{copy.orgRoles.existing}</Text>

        {loading ? (
          <View style={styles.skeletonGroup}>
            {[0, 1].map((index) => (
              <Skeleton key={index} height={88} />
            ))}
          </View>
        ) : roles.length === 0 ? (
          // 載入失敗時不要同時給「暫無管理員」——那會把失敗說成事實
          // （與 `bank-transfers.tsx` 同一條理由）。
          loadError != null ? null : (
            <EmptyState
              kind="first-use"
              headingLevel={2}
              icon="empty-card"
              title={copy.orgRoles.empty}
            />
          )
        ) : (
          <View style={styles.list}>
            {roles.map((role) => (
              <OrgRoleCard key={role.id} role={role} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * 一列組織角色。
 *
 * 資訊順序照 Web：人名 → email → 角色徽章。App 多一個狀態徽章（見檔頭
 * 「與 Web 的差異一」）。
 */
function OrgRoleCard({ role }: { role: EventOrgRole }) {
  const state = orgRoleState(role);

  return (
    <Card testID={`org-role-card-${role.id}`}>
      <View style={styles.cardHead}>
        <View style={styles.cardIdentity}>
          <Text style={styles.person}>{formatOrgRolePerson(role)}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {formatOrgRoleEmail(role)}
          </Text>
        </View>
        <View style={styles.badges}>
          <RoleBadge role={role.role} />
          <StateBadge state={state} testID={`org-role-state-${role.id}`} />
        </View>
      </View>
    </Card>
  );
}

/**
 * 角色徽章。
 *
 * 一律走 `semantic.status.neutral`：角色本身沒有「好／壞」的語意，用顏色去區分
 * 只會暗示 SUPER_ADMIN 比 OPERATOR「好」。真正需要顏色的判斷在下面的狀態徽章。
 */
function RoleBadge({ role }: { role: string }) {
  const tone = semantic.status.neutral;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tone.bg, borderColor: tone.border },
      ]}
    >
      <Text style={[styles.badgeLabel, { color: tone.fg }]}>
        {orgRoleLabel(role, copy.orgRoles.roleLabels)}
      </Text>
    </View>
  );
}

/**
 * 狀態徽章（**Web 沒有這一塊**）。
 *
 * 用 `semantic.status.*`，不自己挑顏色：`contrast` 閘門驗的是 token 組合，
 * 自創的 hex 不會被它守到。
 */
function StateBadge({
  state,
  testID,
}: {
  state: "active" | "pending";
  testID: string;
}) {
  const tone =
    state === "active" ? semantic.status.success : semantic.status.warning;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tone.bg, borderColor: tone.border },
      ]}
      testID={testID}
    >
      <Text style={[styles.badgeLabel, { color: tone.fg }]}>
        {copy.orgRoles.stateLabels[state]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semantic.bg.canvas },
  body: {
    padding: spacing.screen,
    gap: spacing.gap,
  },
  myRole: { ...type.caption, color: semantic.text.secondary },
  sectionTitle: { ...type.label, color: semantic.text.primary },
  skeletonGroup: { gap: spacing.gap },
  list: { gap: spacing.gap },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space[2],
  },
  cardIdentity: { flex: 1, minWidth: 0 },
  person: { ...type.label, color: semantic.text.primary },
  email: { ...type.caption, color: semantic.text.secondary },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: space[1],
    maxWidth: layout.touchMin * 3,
  },
  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  badgeLabel: { ...type.caption },
});
