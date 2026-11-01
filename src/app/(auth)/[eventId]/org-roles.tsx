import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceChips } from "@/components/ui/ChoiceChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldInput } from "@/components/ui/FieldInput";
import {
  InlineBanner,
  type InlineBannerTone,
} from "@/components/ui/InlineBanner";
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
import type { EventOrgRole, EventOrgRoleType } from "@/types/orgRole.types";
import {
  classifyOrgRoleError,
  formatOrgRoleEmail,
  formatOrgRolePerson,
  orgRoleLabel,
  orgRoleState,
} from "@/utils/org-role-display";
import {
  buildOrgRoleInviteConfirmation,
  buildOrgRoleInviteRequest,
  type OrgRoleInviteIntent,
  validateOrgRoleInvite,
} from "@/utils/org-role-invite";
import {
  buildOrgRoleRemoveConfirmation,
  buildOrgRoleRemoveRequest,
  canRemoveOrgRole,
  type OrgRoleRemoveConfirmation,
} from "@/utils/org-role-remove";

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
 * ## 為什麼**沒有**「接受邀請」的畫面（查證後跳過）
 *
 * 後端有第四條路由 `POST …/org-roles/accept`（`engagement.routes.ts:45`），
 * `orgRoleService.accept()` 也已經照它建模。但這一頁刻意**不做**接受介面，
 * 理由是那條路由在整個系統裡**沒有辦法被使用**：
 *
 * | 環節 | 現況 |
 * | --- | --- |
 * | 後端寄邀請信？ | **沒有**。`inviteOrgRole` 只把 token 放在回應裡回給**邀請者**（`EventOrgRoleService.ts:84-90`），全後端沒有組 org-role 邀請信的程式碼 |
 * | Web 有接受頁面？ | **沒有**。`acceptEventAdminInvite`（`lib/events/engagement.ts:153`）**零呼叫點**，而且 method 寫錯（`PATCH`，後端只有 `POST`） |
 * | 被邀請者拿得到 token？ | **拿不到**——上面兩條加起來就是答案 |
 *
 * 也就是說：這不是「Web 有、App 沒有」的落差，而是**兩邊都沒有**的功能。
 * 在 App 做一個接受畫面，等於發明一個 Web 沒有的入口，而且那個入口沒有 token
 * 可以輸入。所以跳過，並把結論留在這裡——下一個人若在 Web 補了接受頁，這裡
 * 就是「該跟著做」的起點。
 *
 * 附帶一個必須知道的後端行為：`inviteOrgRole` 對**已經有帳號**的 email 會直接
 * 寫 `acceptedAt: new Date()`（`EventOrgRoleService.ts:75`），也就是「當場生效、
 * 不需要接受」；只有「沒有帳號」的 email 會停在待接受。而那種待接受的邀請，
 * 因為沒有寄信，會一直是待接受——這正是清單上「待接受」徽章與說明存在的原因。
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

  /** 表單欄位。Web 的預設角色也是 `COORDINATOR`（`org-roles/page.tsx:38`）。 */
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EventOrgRoleType>("COORDINATOR");
  const [emailError, setEmailError] = useState<string | null>(null);
  /**
   * 待確認的邀請意圖。
   *
   * 按下「邀請」只會**建立意圖**，不會送出任何請求；唯一的送出點是確認框的
   * `onConfirm`（見 `submitInvite`）。這是「確認前的狀態不會被送出」的實作位置。
   */
  const [pendingInvite, setPendingInvite] =
    useState<OrgRoleInviteIntent | null>(null);
  /**
   * 待確認的移除意圖。與邀請同一個設計：按下只建立意圖，確認才送出。
   */
  const [pendingRemove, setPendingRemove] = useState<{
    role: EventOrgRole;
    confirmation: OrgRoleRemoveConfirmation;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: InlineBannerTone;
    message: string;
  } | null>(null);

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

  /** 建立意圖（不送出）。 */
  function requestInvite() {
    const intent: OrgRoleInviteIntent = { email, role };
    const block = validateOrgRoleInvite(intent);

    setFeedback(null);
    if (block != null) {
      setEmailError(copy.orgRoles.emailRequired);
      return;
    }

    setEmailError(null);
    setPendingInvite(intent);
  }

  /**
   * 唯一的送出點。
   *
   * `buildOrgRoleInviteRequest(..., { confirmed })` 在 `confirmed === false` 時回
   * `null`——所以「意圖存在但還沒確認」這個狀態**不可能**產生請求。這裡保留
   * `confirmed` 參數而不是讓呼叫端自己判斷，是為了讓那條規則住在
   * `utils/org-role-invite.ts`（可被 `node:test` 釘住），而不是住在畫面裡。
   */
  async function submitInvite(intent: OrgRoleInviteIntent) {
    const payload = buildOrgRoleInviteRequest(intent, { confirmed: true });
    if (payload == null) return;

    setSubmitting(true);
    try {
      await orgRoleService.invite(eventId, payload);
      setPendingInvite(null);
      setFeedback({
        tone: "success",
        message: copy.orgRoles.inviteSuccess(payload.email.trim()),
      });
      // 與 Web 一樣：成功後清空 email 並重新載入名單
      // （`org-roles/page.tsx:108-111`）。角色刻意**不重設**——連續邀請同一個
      // 角色是常見操作，每次跳回預設值只是多一次點擊。
      setEmail("");
      setReloadKey((key) => key + 1);
    } catch (error) {
      const { kind } = classifyOrgRoleError(error);
      setPendingInvite(null);
      setFeedback({ tone: "danger", message: copy.orgRoles.errors[kind] });
      // 已經有人了／活動不見了 ⇒ 名單已經不是我們以為的樣子，一定要重讀。
      if (kind === "alreadyExists" || kind === "notFound") {
        setReloadKey((key) => key + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  /** 建立移除意圖（不送出）。 */
  function requestRemove(role: EventOrgRole) {
    setFeedback(null);
    setPendingRemove({
      role,
      confirmation: buildOrgRoleRemoveConfirmation(
        role,
        copy.orgRoles.roleLabels,
      ),
    });
  }

  /**
   * 移除的唯一送出點。
   *
   * `buildOrgRoleRemoveRequest` 同時擋掉「還沒確認」與「這一列本來就不該移除」
   * （見 `utils/org-role-remove.ts`）——所以即使畫面的條件日後漂掉，一個
   * 移除 SUPER_ADMIN 的請求也不會被產生。
   */
  async function submitRemove(role: EventOrgRole) {
    const request = buildOrgRoleRemoveRequest(role, {
      confirmed: true,
      gateDisabled,
    });
    if (request == null) {
      setPendingRemove(null);
      return;
    }

    setSubmitting(true);
    try {
      // 路徑上的 id 是 EventOrgRole.id，不是 user id。
      await orgRoleService.remove(eventId, request.orgRoleId);
      setPendingRemove(null);
      setFeedback({
        tone: "success",
        message: copy.orgRoles.removeSuccess(formatOrgRoleEmail(role)),
      });
      setReloadKey((key) => key + 1);
    } catch (error) {
      const { kind } = classifyOrgRoleError(error);
      setPendingRemove(null);
      setFeedback({ tone: "danger", message: copy.orgRoles.errors[kind] });
      // 那一列已經不是我們以為的樣子（被別人移除了／活動不見了）⇒ 一定要重讀。
      if (kind === "notFound") {
        setReloadKey((key) => key + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

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

        {feedback ? (
          <InlineBanner
            compact
            tone={feedback.tone}
            message={feedback.message}
            dismissible
            onDismiss={() => setFeedback(null)}
          />
        ) : null}

        {/* 邀請表單。`gateDisabled` 時整段鎖住——不提供註定 403 的按鈕。 */}
        <Card testID="org-roles-invite-form">
          <View style={styles.formHead}>
            <Text style={styles.sectionTitle}>{copy.orgRoles.inviteNew}</Text>
            {gateDisabled ? (
              <Text style={styles.viewOnly}>{copy.orgRoles.viewOnly}</Text>
            ) : null}
          </View>

          <FieldInput
            label={copy.orgRoles.email}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError != null) setEmailError(null);
            }}
            placeholder={copy.orgRoles.emailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!gateDisabled}
            required
            error={emailError ?? undefined}
            testID="org-roles-invite-email"
          />

          <ChoiceChips
            label={copy.orgRoles.roleField}
            options={INVITE_ROLE_OPTIONS}
            value={role}
            labelFor={(value) => orgRoleLabel(value, copy.orgRoles.roleLabels)}
            onSelect={setRole}
            testID="org-roles-invite-role"
          />

          <Button
            label={copy.orgRoles.invite}
            onPress={requestInvite}
            disabled={gateDisabled}
            testID="org-roles-invite-submit"
          />
        </Card>

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
            {roles.map((entry) => (
              <OrgRoleCard
                key={entry.id}
                role={entry}
                gateDisabled={gateDisabled}
                onRemove={() => requestRemove(entry)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {pendingInvite ? (
        <InviteDialog
          confirmation={buildOrgRoleInviteConfirmation(
            pendingInvite,
            copy.orgRoles.roleLabels,
          )}
          busy={submitting}
          onConfirm={() => void submitInvite(pendingInvite)}
          onCancel={() => setPendingInvite(null)}
        />
      ) : null}

      {pendingRemove ? (
        <RemoveDialog
          confirmation={pendingRemove.confirmation}
          busy={submitting}
          onConfirm={() => void submitRemove(pendingRemove.role)}
          onCancel={() => setPendingRemove(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * 邀請的角色選項。
 *
 * **恰好兩個**，逐字照 Web 的 `<select>`（`org-roles/page.tsx:235-238`）：
 * `COORDINATOR` 與 `OPERATOR`。後端 `EventOrgRoleType` 有五個值，但 Web 的
 * 邀請介面從不提供 `SUPER_ADMIN`（那會讓人繞過「只有擁有者能授權」的設計）、
 * 也沒有 `VOLUNTEER` / `MEDIA` 的入口。App 多給一個選項就是**新增能力**——
 * 那正是「不增不減」要擋的事。清單仍然會顯示這三個值（既有資料可能有），
 * 由 `orgRoleLabel()` 顯示。
 */
const INVITE_ROLE_OPTIONS: readonly EventOrgRoleType[] = [
  "COORDINATOR",
  "OPERATOR",
];

/**
 * 邀請的二次確認框。
 *
 * 形狀照 `bank-transfers.tsx` 的 `ReviewDialog` / `content.tsx` 的
 * `ConfirmDialog`：自繪 `Modal`、按鈕順序「主動作在上、取消在下」。不用 RN 的
 * `Alert.alert`（全案沒有用過它）。
 *
 * 兩行內容（email／角色）不是裝飾：這是**給出後台權限**，而唯一能在按下確認前
 * 發現「貼錯 email」或「選錯角色」的資訊就是這兩行。
 */
function InviteDialog({
  confirmation,
  busy,
  onConfirm,
  onCancel,
}: {
  confirmation: { email: string; role: string };
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
        <View style={styles.dialog} testID="org-roles-invite-confirm">
          <Text style={styles.dialogTitle}>
            {copy.orgRoles.inviteConfirm.title}
          </Text>
          <Text style={styles.dialogIntro}>
            {copy.orgRoles.inviteConfirm.intro}
          </Text>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>
              {copy.orgRoles.inviteConfirm.emailLabel}
            </Text>
            <Text style={styles.confirmValue} testID="org-roles-confirm-email">
              {confirmation.email}
            </Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>
              {copy.orgRoles.inviteConfirm.roleLabel}
            </Text>
            <Text style={styles.confirmValue} testID="org-roles-confirm-role">
              {confirmation.role}
            </Text>
          </View>

          <Button
            label={copy.orgRoles.inviteConfirm.confirm}
            onPress={onConfirm}
            loading={busy}
            disabled={busy}
            testID="org-roles-invite-confirm-submit"
          />
          <Button
            label={copy.common.cancel}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            testID="org-roles-invite-confirm-cancel"
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * 一列組織角色。
 *
 * 資訊順序照 Web：人名 → email → 角色徽章。App 多一個狀態徽章（見檔頭
 * 「與 Web 的差異一」）。
 *
 * 移除鈕是否出現由 `canRemoveOrgRole()` 決定（不是寫在這裡的 `if`）：那個判斷
 * 對應後端「沒有最後一個 OWNER／自我移除保護」的查證結果，值得被測試釘住。
 */
function OrgRoleCard({
  role,
  gateDisabled,
  onRemove,
}: {
  role: EventOrgRole;
  gateDisabled: boolean;
  onRemove: () => void;
}) {
  const state = orgRoleState(role);
  const removable = canRemoveOrgRole(role, { gateDisabled });
  /**
   * 只有「呼叫者本來有能力移除別人、但這一列被鎖住」時才解釋。
   *
   * `gateDisabled` 為真時整頁已經是唯讀（上方已有權限說明），再逐列重複一次
   * 只是噪音。
   */
  const locked = !gateDisabled && role.role === "SUPER_ADMIN";

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

      {removable ? (
        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button
              label={copy.orgRoles.remove}
              variant="danger"
              onPress={onRemove}
              testID={`org-role-remove-${role.id}`}
            />
          </View>
        </View>
      ) : null}

      {/* Web 是靜默地不畫按鈕（org-roles/page.tsx:295），什麼都不說。 */}
      {locked ? (
        <Text style={styles.locked}>{copy.orgRoles.superAdminLocked}</Text>
      ) : null}
    </Card>
  );
}

/**
 * 移除的二次確認框。
 *
 * 形狀與 `InviteDialog` 相同（自繪 `Modal`、主動作在上）。三行內容——管理員、
 * email、角色——是**Web 沒有的**：Web 的確認只有「確定移除此管理員？」一句，
 * 清單一長就等於沒有確認作用。
 */
function RemoveDialog({
  confirmation,
  busy,
  onConfirm,
  onCancel,
}: {
  confirmation: OrgRoleRemoveConfirmation;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
        <View style={styles.dialog} testID="org-roles-remove-confirm">
          <Text style={styles.dialogTitle}>
            {copy.orgRoles.removeConfirm.title}
          </Text>
          <Text style={styles.dialogIntro}>
            {copy.orgRoles.removeConfirm.intro}
          </Text>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>
              {copy.orgRoles.removeConfirm.personLabel}
            </Text>
            <Text style={styles.confirmValue} testID="org-roles-remove-person">
              {confirmation.person}
            </Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>
              {copy.orgRoles.removeConfirm.emailLabel}
            </Text>
            <Text style={styles.confirmValue} testID="org-roles-remove-email">
              {confirmation.email}
            </Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>
              {copy.orgRoles.removeConfirm.roleLabel}
            </Text>
            <Text style={styles.confirmValue} testID="org-roles-remove-role">
              {confirmation.role}
            </Text>
          </View>

          <Button
            label={copy.orgRoles.removeConfirm.confirm}
            variant="danger"
            onPress={onConfirm}
            loading={busy}
            disabled={busy}
            testID="org-roles-remove-confirm-submit"
          />
          <Button
            label={copy.common.cancel}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            testID="org-roles-remove-confirm-cancel"
          />
        </View>
      </View>
    </Modal>
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
  formHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[2],
  },
  viewOnly: { ...type.caption, color: semantic.text.muted },
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
  /**
   * 卡片內動作列。
   *
   * 與 `bank-transfers.tsx` / `ticket-types.tsx` 同一個處理：加上分隔線，否則
   * 按鈕會看起來像屬於上面那行字。
   */
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: space[2],
    marginTop: space[2],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border.decorative,
  },
  /** 動作鈕不撐滿卡片寬度（`Button` 預設 `fullWidth`），用外層限寬。 */
  actionButton: { minWidth: layout.touchMin * 2.6 },
  locked: { ...type.caption, color: semantic.text.muted },

  // ── 二次確認彈窗 ──────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: semantic.bg.scrim,
    justifyContent: "center",
    padding: spacing.screen,
  },
  dialog: {
    backgroundColor: semantic.bg.surface,
    borderRadius: radius.lg,
    padding: spacing.screen,
    gap: spacing.gap,
    maxHeight: "88%",
  },
  dialogTitle: { ...type.h3, color: semantic.text.primary },
  dialogIntro: { ...type.caption, color: semantic.text.secondary },
  confirmRow: { gap: space[1] },
  confirmLabel: { ...type.caption, color: semantic.text.muted },
  confirmValue: { ...type.label, color: semantic.text.primary },
});
