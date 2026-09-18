# WhatsApp 通知 — Event Admin App 任務指派（feiteng2015）

> 用途：把 Notion Card 的核心內容濃縮成 WhatsApp 訊息，直接貼給 feiteng2015。
> 格式：繁體中文，簡短、行動導向、可手機閱讀。

---

## 📋 複製以下訊息（貼到 WhatsApp）：

```
【LinkCard Event Admin App — 開發任務派發】

阿聰你好，Event Admin App 的開發任務已經整理好放上 Notion 了，麻煩你睇吓。

🔗 Notion Card：
https://www.notion.so/...（貼上你的 Notion 連結）

📌 背景一句話：
App 骨架已經做好，而家要補現場功能（掃碼簽到 + Token + NFC + 名單），11月澳門創業節要上線。

✅ 第 1 日就可以開工（4.5 人日）：
1. WP-A1 EAS Build 驗證（0.5 日）
2. WP-A7 簽到三態 + 震動/大字/音效（2.25 日）
3. WP-A8 降級儀表板 + Web check-in 入口（1 日）

⏳ 之後做（要等後端前置）：
4. WP-A6 NFC 綁定強化（等 WP-N2）
5. WP-A4 Token 櫃台 Web（等 B-1a）
6. WP-A5 名單/搜尋/詳情（等 B-6 + T-1）

📁 文件位置（repo docs/handoff/ 起手）：
- README.md（索引）→ 00-OVERVIEW → 01-FUNCTIONAL-SUMMARY → 02-API-CONTRACT-GUIDE → 04-KNOWN-PITFALLS（必讀！有踩雷地圖）

⚠️ 三個地雷先記住：
1. 登入一定要用 promoter 端點，唔好用一般 /api/auth/login（會 401）
2. Token 扣減動詞係 deduct，唔係 redeem
3. tsc 過 ≠ 可用，每個功能要真機截圖/錄影

🗓️ 時間錨點：
- 9/22 NFC 硬體最後下單日
- 9/28 NFC Gate 1 spike
- 11/12 現場演練
- 11/15 活動日 🔴

有問題隨時問，加油！🚀
```

---

## 更短的版本（如果 feiteng2015 很忙，只發這條）：

```
【Event Admin App 任務已派發】
阿聰，開發任務已放上 Notion（掃碼簽到 + Token + NFC + 名單，11月創業節上線）。
✅ 第1日可開工 3 個 WP（EAS Build / 簽到三態 / 降級儀表板），共 4.5 人日。
📁 文件在 repo docs/handoff/ 起手，04-KNOWN-PITFALLS 必讀（有 3 個地雷）。
⏳ Token 櫃台同名單要等後端前置（我會處理）。
🗓️ 9/22 硬體下單、9/28 NFC spike、11/15 活動日。
有問題隨時問！🚀
```
