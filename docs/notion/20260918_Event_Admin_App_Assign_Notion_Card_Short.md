# LinkCard Event Admin App — 現場功能開發（簡短版）

> 指派：**feiteng2015** ｜ 期限：**11月澳門創業節** ｜ 完整版見 `20260918_Event_Admin_App_Assign_Notion_Card.md`

---

## 一句話

App 骨架已完成，需補**現場功能**（掃碼簽到 + Token + NFC + 名單），11 月創業節上線。

## 第 1 天可開工（4.5 人日）

| WP | 內容 | 人日 |
|:-:|------|:-:|
| **WP-A1** | EAS Build 驗證（App 從未 build）| 0.5 |
| **WP-A7** | 簽到三態 + 震動/大字/音效 | 2.25 |
| **WP-A8** | 降級儀表板 + Web check-in 入口 | 1.0 |

## 之後做（等後端前置）

| WP | 內容 | 前置 |
|:-:|------|------|
| **WP-A6** | NFC 綁定強化（換卡/補發/退卡）| WP-N2 |
| **WP-A4** | Token 櫃台（Web）| B-1a |
| **WP-A5** | 名單/搜尋/詳情 | B-6 + T-1 |

## 文件位置
`repo/docs/handoff/` 起手：README → 00-OVERVIEW → 01-FUNCTIONAL-SUMMARY → 02-API-CONTRACT-GUIDE → **04-KNOWN-PITFALLS（必讀）**

## 3 個地雷
1. 登入用 promoter 端點（唔好用 /api/auth/login）
2. Token 扣減動詞係 **deduct**（唔係 redeem）
3. tsc 過 ≠ 可用，要真機截圖

## 時間錨點
9/22 硬體下單 ｜ 9/28 NFC spike ｜ 11/12 演練 ｜ **11/15 活動日**

## DoD
- [ ] 每個 WP：tsc 0 error + lint 0 error
- [ ] 每個 WP：真機/瀏覽器截圖或錄影
- [ ] commit：hackathon 式小步（含 WP 編號）
