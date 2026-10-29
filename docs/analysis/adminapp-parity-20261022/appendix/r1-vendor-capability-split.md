# R1 — 廠商能力切分：現場／門側 App 與主辦方 Web 後台

本文只回答一件事：在成熟 event tech 產品裡，哪些能力被放進「現場／門側手機或平板 App」，哪些被留在「主辦方 Web 後台」，以及廠商有沒有明文說明為什麼。

判讀規則：

- 只有廠商自己的 docs、help centre、product page、app store listing 才當成「廠商文件」。
- 只有第三方評測、比較頁才當成「次級來源」。
- 文件只寫 web 操作路徑、而 App 文件完全沒有對應功能時，標 `(推論)`，不當成廠商明文排除。
- 找不到任何公開描述時標 `(未能查證)`。
- 引用原文時保留英文原句，不翻譯、不改寫。

---

## 一、六家廠商對照表

| vendor                               | 是否有門側／現場 App                                                                                      | 手機 App 的核心能力                                                                                                                                                                    | 明確只在 Web 後台的能力                                                                                                                                                                                           | 來源 URL                                                                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Eventbrite**（Organizer app）      | 是。Eventbrite Organizer，iOS／Android 手機與平板 [1][5]                                                  | 掃 QR check-in、手動 check-in、即時銷售與 attendance、on-site 售票與收款、訂單 reissue／cancel／refund、建立與編輯活動、guest list 建立與報到 [1][4][5]                                | 報名資料編輯（官方只給 Event Dashboard → Manage Orders 路徑）[3]、報名表單與票種設定 [6]、session／agenda 管理（產品無此模組，`(推論)`）[6]、原生 polls（`(推論)`，次級來源指其 engagement 原生能力有限）[46][47] | https://www.eventbrite.ca/help/en-ca/articles/544246/how-to-edit-attendee-information ；https://www.eventbrite.com/help/en-us/articles/883605/set-up-the-organizer-app-on-your-phone-or-tablet |
| **Whova**（organizer + attendee）    | 是，但不是獨立 organizer app：主辦方在 Whova App 內的 `Admin Tools` 操作 [9]；另有 Check-In Kiosk App [8] | Event／Day／Session check-in、QR 掃描、mobile session checkout（加購）、即時名單、講者可在手機建立 poll 與管理 Q&A、exhibitor 可在手機編 booth profile 與掃 lead [9][11][12][13]       | Agenda Center／Session Manager 建 session、指派講者、Excel 匯入 [10]、報名與票種 [53]、攤位銷售／Exhibitor 後台／floormap [13][14][49]、報表與 poll 結果匯出 [15]                                                 | https://whova.zendesk.com/hc/en-us/articles/360020638492-Can-I-use-the-App-to-check-in-attendees ；https://whova.zendesk.com/hc/en-us/articles/11083901904795-How-can-I-add-set-up-sessions    |
| **Cvent**（OnArrival／Attendee Hub） | 是。OnArrival 是現場 staff app（iOS／Android）[16][20][21]；Attendee Hub Event App 是與會者 app [18][19]  | 報到、walk-in 報名、現場修改 attendee contact details、on-demand badge printing、session check-in 與容量控制、現場收款 [16][17][20]                                                    | 活動與報名網站建置、agenda／session 設定、exhibitor 管理、Attendee Hub 內容與 poll 建置、全域報表 [17][18][22]（多數屬 `(推論)`：官方只描述 Event Management 端設定）                                             | https://www.cvent.com/en/event-marketing-management/onarrival-event-check-in-software ；https://www.cvent.com/en/event-marketing-management/attendee-hub                                       |
| **zkipster**                         | 是。zkipster app，iOS／Android；seating 只在 iPad 與 Android tablet [23][24]                              | 賓客搜尋、check-in／check-out、QR／barcode、kiosk mode、facesheet、新增賓客、vCard 掃描、session 報到、tablet 上編座位、現場列印名牌 [23][24]                                          | 賓客欄位設定與大量編輯 [26][27]、seat chart 完整編輯（手機不支援）[24]、邀請／RSVP 表單 [28]、使用者與權限 [29]、報表 [26]                                                                                        | https://support.zkipster.com/en/articles/3815820-how-to-check-in-guests-on-ios-and-android-devices ；https://www.zkipster.com/guestlistapp                                                     |
| **Expo Pass**                        | 是，但形態是 iPad kiosk：Expo Pass iPad app 的 kiosk／Admin Toolkit，不是手機 staff app [30][31]          | 姓名／QR 報到、kiosk 自助報到、現場註冊、有限欄位編輯（需 passcode）、即時 badge 列印、session 掃描 [30][31][32][35]                                                                   | 報名表單與票種、Badge Designer、session／agenda 設定、exhibitor 與 lead retrieval 設定、analytics、mobile app 內容與 branding [30][33][35][50]                                                                    | https://www.expopass.com/check-in-badge-printing ；https://support.expopass.com/en/articles/8006506-onsite-check-in-attendee-edits-their-own-data                                              |
| **Swapcard**                         | 是。SwapAccess 是掃描用 app（官方文件要求 iOS device）[39][40][45]；Swapcard attendee app 是參與者端 [42] | SwapAccess：session／checkpoint badge 掃描、access control、offline、kiosk mode [39][40][45]；attendee app：agenda、poll 作答、Q&A、networking、exhibitor booth、lead capture [42][43] | Studio：報名、session 建立、exhibitor 管理、poll 建立與管理（官方明文 mobile 不支援）、badge／列印、analytics [36][37][38][41][44]                                                                                | https://help.swapcard.com/en/articles/8159023-managing-polls-polls-user-guide ；https://help.swapcard.com/en/articles/9423581-get-started-with-swapcard-as-an-event-organizer                  |

---

## 二、逐家觀察

### 2.1 Eventbrite — 最窄的「door app」

Eventbrite Organizer 的定位非常清楚：它是門側工具，不是縮小版後台。官方描述是「check-in attendees, sell tickets, and manage your event onsite」[1]，產品頁則稱它是「the all-in-one mobile solution for event management at your fingertips」[2]。App 內有 dashboard，顯示 sales 與 check-ins 的即時概況 [1]；可以掃 QR、手動搜尋名單報到、設定 multi-slot check-in、切換 scan behavior（check-in／check-out／validate only）[1]。

它也能處理交易：reissue、cancel、refund、on-site 售票與付款 [5]。這一點常被低估——現場 App 不是只能掃碼，它承擔了「現場營收與例外處理」。

但報名資料編輯不在 App。官方 help centre 的「Edit attendee information and add notes」從第一步就把使用者帶到 Event Dashboard：

> "To get started, go to your Event Dashboard and select Manage Orders (under Manage attendees ). Then select Actions and choose Edit ticket buyer or Edit attendee info ." [3]

同一篇文件從頭到尾沒有出現 Organizer app 路徑 [3]。這不是偶然，因為 Eventbrite 對 guest list 的設計本來就限制編輯：guest list 建了之後，guest order「can't be edited」，只能刪掉重加 [4]。也就是說，Eventbrite 把「名單建立與報到」放進 App，把「報名資料修正」留在 Web。`(推論)`：這是刻意把身份資料的寫入權限留在有完整權限與審計的後台。

Session／agenda 不是 Eventbrite 的核心模組。官方 registration 功能頁列的是報名表單、票種、check-in、即時報表，沒有 session manager [6]。`(推論)`：Eventbrite 的產品邊界是 ticketing + registration，不是 conference program management。

Polls 也不是原生能力。次級評測把 Eventbrite 的「Audience engagement（live chat, polls, Q&A, gamification）」評得很低，並指出其原生 engagement 有限、常需外部工具 [46][47]。這是次級來源，不是廠商明文否認，所以標 `(推論)`。

### 2.2 Whova — 沒有獨立 organizer app，admin 功能嵌入 attendee app

Whova 的切分方式和 Eventbrite 不同。它不是另做一個 organizer app（`(推論)`：未見獨立 organizer app 的公開文件），而是讓 admin 與 check-in staff 在 Whova App 裡看到 `Admin Tools`：

> "All admins and check-in staff will have access to the Check-In Tool in the Mobile App." [9]

實際路徑是 `Mobile App > Home > Admin Tools > Attendee Check-In`，可以選 Event、Day 或 Session check-in，也可以掃 QR [9]。另外有 mobile session checkout 加購，讓 staff 在手機上把與會者簽退 [11]。這些都是典型的門側工作。

Whova 也把「講者操作」放進手機：講者可從 `Speaker Hub` 建立 poll、看即時結果 [12]。這是六家裡最特別的例外——poll 的「建立」不只在 Web。但主辦方的議程建立仍完全在 Web 的 Agenda Center：

> "Content > Agenda Center > Session Manager > Build the agenda from scratch" [10]

同一個 help centre 也說明議程可以用 Excel 匯入、可以重用往年議程、可以請 Whova 代建 [10]。這些都是大量、結構化的內容操作，放在 Web 很合理。

Whova 對「哪些東西在 mobile、哪些在 backend」還有一個很少見的明說，不過方向是反過來——它在 exhibitor guide 裡說：

> "The exhibitor portal is part of the “backend” of Whova products. Some features that are only available on the mobile app are not available here. For example, you cannot update your photos or company name, message attendees or scan leads." [13]

這句話的價值在於：Whova 承認 mobile 與 web 不是互相取代，而是各自有「only available」的能力。Exhibitor 可以在手機編 booth profile、管理 booth staff、掃 lead [13]；但攤位銷售、tier、floorplan、主辦方視角的 exhibitor 管理在 Web [13][14][49]。

### 2.3 Cvent — 兩個 App、一個後台，切分最清楚

Cvent 是六家裡產品線最完整、也最值得 LinkCard 對照的。它有三個介面：

1. **OnArrival**：現場 staff app，負責報到、walk-in、badge printing、session 報到、現場收款 [16][17][20]。
2. **Attendee Hub Event App**：與會者 app，負責 agenda、networking、Q&A、polls、exhibitor 互動 [18][19][48]。
3. **Event Management（Web）**：建活動、建報名網站、設 agenda、設 exhibitor、設 Attendee Hub 內容與 poll、看報表 [17][18][22]。

最關鍵的一句是 OnArrival 的產品頁：

> "Access or modify attendee details via desktop, phone, or tablet" [16]

以及：

> "Edit attendee contact details on the fly" [16]

這代表 Cvent 明確把「現場修改報名資料」視為門側 App 的正當能力，而不是禁止。它甚至把 walk-in 報名、現場付款、session 容量控制都放進去 [17]。Cvent 的 rationale 不是「手機不該編輯」，而是「現場需要即時修正，否則 badge 印錯、名單不準」。

另一個值得注意的訊號是 Cvent 自己承認 mobile parity 是進行式。OnArrival 的 Android listing 寫：

> "Look for more releases in the future as we continue to work toward feature parity with our existing iOS app." [21]

這句話不是 web vs mobile 的 parity，而是 iOS vs Android 的 parity；但它證明「feature parity」在廠商語彙裡是一個 roadmap 目標，不是宣稱已經達成的事實。對 LinkCard 的意義是：不要用「parity」當成單一標準，要先定義是哪兩個 client 之間的 parity。

Cvent 的 poll 建立發生在 Attendee Hub 的活動建置流程，App 端是作答與互動 [18][19]。官方沒有像 Swapcard 那樣寫「poll creation 不支援 mobile」，所以這一段標 `(推論)`。

### 2.4 zkipster — 把「現場」做到極致，但明確限制裝置與欄位

zkipster 的門側 App 是六家裡最「現場優先」的。官方說：

> "Check-in for events is best when exclusively on the app interface." [24]

它支援 offline check-in、多裝置同步、kiosk mode、facesheet、relationships、+1 一起報到、session 報到 [23][24]。它也允許在 App 內新增賓客、用 vCard 掃描 walk-in [24]。這些都直接對應 LinkCard 的 walk-in 與 registrant detail。

但 zkipster 對「手機不是萬能」說得非常直白，而且是逐項限制：

> "The Seating feature is only available on iPad devices and Android tablet. Android for mobile devices and iPhones do not support seating and you won't see the icon." [24]

> "To set which columns to appear on the app and in what order go to the Guest Fields section in the zkipster browser." [24]

> "the changes you make here only apply to the browser version of zkipster." [26]

App 內也可以調欄位順序，但那份設定是 per-event，切到別的活動或關掉 App 就會 reset [25]。這三句合起來就是一個清楚的設計哲學：**現場查詢與報到要快，所以 mobile 只放高頻、低複雜度的操作；欄位結構、座位圖、大量編輯屬於設定型工作，留在 Web。** 大量編輯（bulk edit guest fields）也只存在於 Web help [27]；使用者與權限則在 Account Settings，只有 Account Owner 能進 [29]。

zkipster 沒有 exhibitor 模組，產品線是 Events、Audience、Wallet Pass、Communications、Forms、Payments、Guest Management、Seating、Check-in [28]。`(推論)`：因此「參展商／攤位管理」在 zkipster 不是「Web-only」，而是「不存在」。Polls 也不是其模組 [28]，標 `(推論)`。

### 2.5 Expo Pass — kiosk 優先，不是手機 staff app

Expo Pass 的現場形態和另外五家不同：它的門側裝置是 iPad kiosk，而不是 staff 手上的手機（`(推論)`：公開文件只描述 iPad，未見手機 staff app）。官方 check-in 頁說：

> "Attendees can search by name or scan QR code to check-in" [30]

> "Check and make changes to registration data on-site" [30]

實際操作是：staff 在 iPad 上登入 Expo Pass app，進 event，開 `Admin Toolkit`，設 kiosk passcode [31]。與會者可以在 kiosk 上修改 badge 上有顯示的欄位（First Name、Last Name、Company、Position），但有三個前提：

1. Web 端 Event Settings → Onsite 要先開 `Edit Attendee During Check In` [31]。
2. 欄位要在 `Set Up Attendee Fields` 勾 `Editable By Attendee` [31]。
3. 修改時要輸入 kiosk passcode [31]。

這是六家裡對「現場編輯」設計得最保守、也最有治理感的一家：**不是不能改，而是預設關閉、必須在 Web 開權限、只能改 badge 欄位、而且要 passcode。** 對 LinkCard 來說，這是一個可以直接抄的模式。

Expo Pass 的 mobile event app 則是與會者端：agenda、session、speaker、sponsor、exhibitor、messaging、push [33][34]。主辦方控制 branding、schedules、banners、Pre-Event／Live／Post-Event 模式，官方明說是在 admin portal：

> "You control branding, schedules, banners, and can even toggle the app between “Pre-Event,” “Live,” and “Post-Event” modes from your admin portal." [33]

Session 的現場操作是掃描與出席紀錄；session 的建立與 agenda 編排則在 Web dashboard [35]。Exhibitor 的 lead capture 有獨立 App 給 exhibitor 用 [50]，但 exhibitor 與 booth 的設定仍在後台 [30][50]。Polls 在 Expo Pass 的公開產品頁沒有出現 [33][35]，標 `(未能查證)`，不宣稱它一定沒有。

### 2.6 Swapcard — 唯一明文寫出「poll 建立不支援 mobile」的廠商

Swapcard 對介面的定義是六家裡最清楚的。Help centre 直接區分：

> "Studio: The Organizer Back-Office or Content Management Software, where organizers create and manage their events and communities." [38]

> "Event App: The application for attendees, exhibitors, speakers, and guests." [38]

> "Exhibitor Center: A web app for exhibitors to manage their team, company profile, meetings with attendees, and export leads." [38]

這段話等於把三個 client 的責任邊界寫成產品定義：Studio 是主辦方後台、Event App 是參與者端、Exhibitor Center 是參展商 Web app。LinkCard 目前只有「Web console + Expo door app」，缺的正是這種「角色 × client」的明文化。

Swapcard 的門側掃描是 SwapAccess。它是內建的 badge scanning app，只做掃描與 access control，不做內容管理：session tracking、checkpoint、scan in／out、offline、kiosk mode [36][39][40][45]。Setup 則在 Studio：

> "Beforehand, in the Studio, Organizers decides to scan Attendees using one of the following three modes" [39]

Poll 的切分是整份研究最有力的一條證據：

> "Please note that poll creation and management functionalities are available exclusively on the web version of the platform; they are not supported on the mobile app." [37]

> "Poll creation is supported only on the web platform, not on mobile." [37]

這句話同時回答了兩件事：第一，業界確實存在「刻意不在 mobile 做」的功能；第二，廠商會把這個限制寫進 help centre，而不是讓使用者自己猜。Swapcard 的 mobile app 可以作答 poll、看 Q&A、networking、看 exhibitor booth [42][43]，但建立 poll 一定要回 Studio。

---

## 三、四個問題

### a. 現場 App 是否包含「報名資料編輯」？

**答案：一半一半，而且沒有廠商把「完整編輯」放進門側 App。**

拆成三種程度來看：

| 程度                                 | 廠商             | 證據                                                                                                                                                                                              |
| ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 完整編輯在 Web，App 不做             | Eventbrite       | 官方 edit attendee info 只給 Event Dashboard → Manage Orders 路徑 [3]；guest order 不能編輯，只能刪掉重加 [4]                                                                                     |
| 完整編輯在 Web，App 可做少量現場修正 | zkipster         | App 可新增賓客、改 session 指派、check-in [24]；大量編輯與欄位設定在 Web [26][27]                                                                                                                 |
| 現場可修改 attendee 資料             | Cvent、Expo Pass | Cvent：「Access or modify attendee details via desktop, phone, or tablet」、「Edit attendee contact details on the fly」[16]；Expo Pass：kiosk 可改 badge 欄位，但需 Web 先開權限與 passcode [31] |
| 未明文，App 以參與者端為主           | Swapcard         | Studio 是 organizer back-office [38]；App 是 attendee app [38][42]，`(推論)` 報名編輯在 Studio                                                                                                    |
| 未明文，但主辦端編輯在 EMS           | Whova            | 與會者可靠 attendee help 自行改報名資料 [51]；主辦端大量編輯在 EMS web，`(推論)`；mobile 只見 check-in／checkout 文件 [9][11]                                                                     |

**廠商是否有明文說明？** 有，但不是每一家都用同一種句式。

- Eventbrite 是「只給 Web 路徑」的消極明文：整篇 edit attendee info 沒有 App 路徑 [3]。
- Cvent 是「正面允許」的明文：直接寫 desktop、phone、tablet 都可以 [16]。
- Expo Pass 是「條件式允許」的明文：要開 `Edit Attendee During Check In`、要勾 `Editable By Attendee`、要 passcode [31]。
- Swapcard 是「角色分工」的明文：Studio 才是 organizer 後台 [38]，但沒有逐條寫「報名編輯不支援 mobile」，所以嚴格說是 `(推論)`。
- Whova 沒有找到「報名編輯只能在 Web」的明文，標 `(推論)`。

對 LinkCard 的判讀：**「不在門側 App 做完整報名編輯」是合理的，但「連有限編輯都不做」比 Cvent、Expo Pass、zkipster 保守。** 業界的共同點不是「App 不能改」，而是「App 只改現場需要的那幾個欄位，而且要有權限與審計」。

### b. 現場 App 是否包含「參展商管理／攤位管理」？

**答案：沒有。六家裡沒有任何一家把 organizer 視角的 exhibitor／booth 管理放進門側 staff app。**

分別看：

- **Whova**：攤位銷售、tier、floorplan、exhibitor 後台在 Web [13][14][49]。Exhibitor 自己可以在手機編 booth profile、管理 booth staff、掃 lead [13]，但那是 exhibitor self-service，不是 organizer 管理。Whova 的 exhibitor guide 甚至明說 exhibitor portal 是 backend，且手機才有某些功能（拍照、改名、訊息、掃 lead）[13]。
- **Swapcard**：Exhibitor Center 是 web app，讓 exhibitor 管理團隊、公司 profile、meetings、leads [38]；organizer 在 Studio 管理 [38][44]。SwapAccess 只掃 badge，不碰 exhibitor 資料 [39]。
- **Cvent**：OnArrival 的功能清單是 check-in、badging、attendance、walk-in、payments、session [16][17]；exhibitor 管理屬 Event Management 與 Attendee Hub 的 Web 建置 [17][18]。
- **zkipster**：產品線沒有 exhibitor 模組 [28]，所以不是 Web-only，而是不存在。
- **Expo Pass**：lead retrieval 是給 exhibitor 用的 App [50]，booth／exhibitor 設定在後台 [30][50]。
- **Eventbrite**：產品是 ticketing／registration，沒有 exhibitor／booth 管理 [6]，`(推論)`。

**模式：exhibitor 管理是「資料建模 + 銷售 + 權限」的工作，全部留在 Web；mobile 只做 exhibitor 現場的 lead capture 與 booth profile 自助編輯。** 這和 LinkCard 把 exhibitors 放在 Web-only 完全一致。

### c. 現場 App 是否包含「議程／session 管理」？

**答案：要分「建立」與「現場執行」。建立幾乎全在 Web；現場執行（報到、掃描、簽退）在 App。**

建立／編輯：

- Whova：`Content > Agenda Center > Session Manager`，可從零建、Excel 匯入、重用往年、請 Whova 代建 [10]。這是 Web。
- Swapcard：`Content → Sessions → Create session`，在 Studio 建立，可設 format、live interaction、exhibitor、attendee [41]。
- Cvent：session 與 agenda 在 Event Management／Attendee Hub 建置 [17][18]。
- Expo Pass：session 與 agenda 在 Web dashboard 設定，App 只做 session 掃描與 attendance [35]。
- Eventbrite：沒有 session manager 模組 [6]，`(推論)`。
- zkipster：Sessions 是產品模組 [28]，App 可把 guest 加進 session、做 session 報到 [24]；建立與設定在 Web，`(推論)`。

現場執行：

- Whova：Event／Day／Session check-in 在 Mobile App 的 Admin Tools [9]；mobile session checkout 是加購 [11]。
- Cvent：OnArrival 可做 session check-in、容量控制、CE 簽名 [17]。
- zkipster：App 有 Sessions tab，可 check-in 來賓到 session [24]。
- Swapcard：SwapAccess 掃 badge 做 session tracking／access control，scan 即自動 check-in [39]。
- Expo Pass：session 掃描、timestamp、CE/CEU 報表 [35]。

**模式：session 的「CRUD」在 Web，「scan／check-in／checkout」在 App。** 這是六家最一致的一條線。對 LinkCard 而言，sessions 留在 Web 是標準做法；但若門側 app 完全沒有 session 報到，就會偏離 Cvent、Whova、zkipster、Swapcard、Expo Pass 的共同做法。

### d. 現場 App 是否包含「投票／polls」？

**答案：作答在 mobile 是常態；建立與管理在 Web 是常態，而且 Swapcard 有明文。**

- **Swapcard**：建立與管理「exclusively on the web version」，mobile 不支援 [37]；mobile app 只讓與會者作答、看 Q&A [42][43]。
- **Whova**：與會者在 app 作答、看結果 [15]；講者可從手機 `Speaker Hub` 建立 poll [12]。這是唯一明確允許「mobile 建立 poll」的例外，但角色是講者，不是主辦方。
- **Cvent**：Attendee Hub 的 polls／Q&A／surveys 是與會者互動功能，Web 與 mobile 都可參與 [18][19]；建立屬活動建置，`(推論)` 在 Web。
- **Eventbrite**：原生 polling 能力有限，次級來源指其 engagement 需外部工具 [46][47]，`(推論)` 沒有原生 poll builder。
- **zkipster**：產品模組沒有 polls [28]，`(推論)` 不提供。
- **Expo Pass**：公開產品頁沒有 polls [33][35]，`(未能查證)`。

**模式：poll 是「live interaction」而不是「door operation」。** 它的建立需要題目、選項、答案、結果可見性、時長，這些是典型 Web 表單；它的消費是手機。LinkCard 把 polls 放 Web-only，與 Swapcard 的明文、Cvent 的建置邏輯一致；差別只在 LinkCard 的門側 app 是否需要在 session 現場開關 poll。`(推論)`：若 LinkCard 的 poll 是由主辦方在 Web 建立、由與會者手機作答，那這個切分是業界標準，不需要補 mobile。

---

## 四、廠商對「為何留在 Web」的原始說法

以下逐字引用，不翻譯。

**1. Swapcard — poll 建立與管理只在 Web**

> "Please note that poll creation and management functionalities are available exclusively on the web version of the platform; they are not supported on the mobile app." [37]

> "Poll creation is supported only on the web platform, not on mobile." [37]

網址：https://help.swapcard.com/en/articles/8159023-managing-polls-polls-user-guide

**2. Swapcard — Studio 的定義就是 organizer back-office**

> "Studio: The Organizer Back-Office or Content Management Software, where organizers create and manage their events and communities." [38]

網址：https://help.swapcard.com/en/articles/9423581-get-started-with-swapcard-as-an-event-organizer

**3. Eventbrite — 報名編輯只給 Web 路徑**

> "To get started, go to your Event Dashboard and select Manage Orders (under Manage attendees ). Then select Actions and choose Edit ticket buyer or Edit attendee info ." [3]

網址：https://www.eventbrite.ca/help/en-ca/articles/544246/how-to-edit-attendee-information

**4. Eventbrite — guest order 不可編輯，只能刪除重加**

> "Guest list orders can’t be edited. Instead, delete and re-add them." [4]

網址：https://www.eventbrite.com/help/en-us/articles/563516/create-manage-and-check-in-guests-on-the-organizer-app

**5. Whova — 手機 Admin Tools 是給 admin 與 check-in staff 的**

> "All admins and check-in staff will have access to the Check-In Tool in the Mobile App." [9]

網址：https://whova.zendesk.com/hc/en-us/articles/360020638492-Can-I-use-the-App-to-check-in-attendees

**6. Whova — 兩種入口，但 dashboard 只給 admin**

> "You can check your attendees in through both the Mobile App and also the EMS Dashboard (please note that only admins have access to the EMS Dashboard)." [52]

網址：https://whova.zendesk.com/hc/en-us/articles/12564026324507-How-do-I-run-attendee-check-in

**7. Whova — mobile 與 backend 各有 only-available 功能**

> "The exhibitor portal is part of the “backend” of Whova products. Some features that are only available on the mobile app are not available here. For example, you cannot update your photos or company name, message attendees or scan leads." [13]

網址：https://whova.com/pages/whova-app-exhibitor-guide

**8. Cvent — 現場修改 attendee 資料是正面能力**

> "Access or modify attendee details via desktop, phone, or tablet" [16]

> "Edit attendee contact details on the fly" [16]

網址：https://www.cvent.com/en/event-marketing-management/onarrival-event-check-in-software

**9. Cvent — parity 是 roadmap，不是現狀**

> "Look for more releases in the future as we continue to work toward feature parity with our existing iOS app." [21]

網址：https://play.google.com/store/apps/details?hl=en_GB&id=com.cvent.onarrival

**10. zkipster — App 欄位順序設在 browser**

> "To set which columns to appear on the app and in what order go to the Guest Fields section in the zkipster browser." [24]

網址：https://support.zkipster.com/en/articles/3815820-how-to-check-in-guests-on-ios-and-android-devices

**11. zkipster — 裝置能力差異是明文限制**

> "The Seating feature is only available on iPad devices and Android tablet. Android for mobile devices and iPhones do not support seating and you won't see the icon." [24]

網址：https://support.zkipster.com/en/articles/3815820-how-to-check-in-guests-on-ios-and-android-devices

**12. zkipster — browser 的變更不會自動等於 App 的變更**

> "the changes you make here only apply to the browser version of zkipster." [26]

網址：https://support.zkipster.com/en/articles/2687314-how-to-manage-your-guest-list

**13. Expo Pass — 內容與模式控制在 admin portal**

> "You control branding, schedules, banners, and can even toggle the app between “Pre-Event,” “Live,” and “Post-Event” modes from your admin portal." [33]

網址：https://www.expopass.com/mobile-event-app

**14. Expo Pass — 現場編輯需要 Web 先開權限**

> "Event Settings ➜ Onsite… Toggle ON Edit Attendee During Check In" [31]

> "Ensure that you have checked your fields at “Editable By Attendee” in the Set Up Attendee Fields section of your event." [31]

網址：https://support.expopass.com/en/articles/8006506-onsite-check-in-attendee-edits-their-own-data

**15. Swapcard — SwapAccess setup 在 Studio**

> "Beforehand, in the Studio, Organizers decides to scan Attendees using one of the following three modes" [39]

網址：https://help.swapcard.com/en/articles/9095307-onsite-session-tracking-with-swapaccess

---

## 五、跨廠商模式：不是「功能對等」，而是「角色 × 場景」切分

把六家放在一起，會看到一個穩定的四層模型，而不是一條「mobile 應有 X% 功能」的線。

| 層         | 典型能力                                                                   | 放在哪裡           | 代表                                                                 |
| ---------- | -------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| 設定層     | 票種、報名表單、badge 設計、欄位結構、角色權限、活動 settings              | Web                | Eventbrite [3][6]、zkipster [26][27][29]、Swapcard [38]              |
| 內容層     | agenda／session 建立、speaker 指派、exhibitor／booth、poll 建立            | Web                | Whova [10][13]、Swapcard [37][41]、Expo Pass [33][35]                |
| 現場執行層 | check-in／out、walk-in、QR／badge 掃描、session 掃描、badge 列印、現場付款 | Mobile／tablet     | Cvent [16][17]、zkipster [23][24]、Expo Pass [30][31]、Whova [9][11] |
| 參與層     | agenda 瀏覽、個人 schedule、poll 作答、Q&A、networking、exhibitor booth    | Mobile（可選 Web） | Whova [7]、Cvent [18][19]、Swapcard [42][43]                         |

這個模型解釋了為什麼「registration editing」會落在中間地帶：它是設定層的資料，但現場又會出錯，所以廠商分成三派——禁止（Eventbrite）、有條件允許（Expo Pass、zkipster）、正面允許（Cvent）。**沒有廠商把完整編輯器放進門側 App；有廠商把「現場必要欄位」放進去。**

也解釋了為什麼 poll 幾乎都在 Web 建立：它屬內容層，和 session 綁定；但作答屬參與層，所以在 mobile。Swapcard 把這件事明文寫出來 [37]，Whova 則把「講者建 poll」當成例外開放 [12]。

還解釋了為什麼 exhibitor 管理一定在 Web：它是設定層 + 銷售 + 權限的組合，Mobile 只做 exhibitor 自己的 lead capture 與 booth profile [13][38][50]。

最後，Cvent 的 Android parity 說法提醒一件事：**「parity」在業界通常指「兩個同類 client 之間」或「同一 client 跨平台」，不是「mobile = web」。** Cvent 說的是 iOS app 與 Android app 的 parity [21]，不是 OnArrival 與 Event Management 的 parity。LinkCard 如果用「mobile 應覆蓋 web 多少百分比」來衡量，會得到一個業界沒有在用的指標。

---

## 六、對 LinkCard 的模組對照

LinkCard Web console 的 13 個模組：overview、profile、content、ticket types、badges、registrations、check-in、exhibitors、sessions、polls、bank transfers、org roles、settings。Expo app 的 10 個畫面：overview、registrations、registrant detail、check-in、walk-in、NFC bind、NFC read、NFC exchange、badges inventory、token/wallet ledger。

| LinkCard 模組                    | 現況                 | 對照業界                                                                 |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| content                          | Web-only             | 一致。內容編排在 Web [10][33]                                            |
| ticket types                     | Web-only             | 一致。票種與報名表單在 Web [3][6]                                        |
| badges（設計／設定）             | Web-only             | 一致。Badge Designer 在 Web [30][33]                                     |
| exhibitors                       | Web-only             | 一致。Exhibitor 管理在 Web／Exhibitor Center [13][38]                    |
| sessions                         | Web-only             | 一致（建立）；但現場 session 報到同業放 App [9][17][24][39]              |
| polls                            | Web-only             | 一致。Swapcard 明文 poll 建立只在 Web [37]                               |
| bank transfers                   | Web-only             | 一致（`(推論)`：屬財務後台，六家均未見門側 App 做匯款核銷）              |
| org roles                        | Web-only             | 一致。zkipster 權限在 Account Settings [29]                              |
| settings                         | Web-only             | 一致。活動／欄位／kiosk 設定在 Web [31][33]                              |
| profile                          | Web-only             | 一致（`(推論)`：屬設定層）                                               |
| registrations／registrant detail | App 有，但以查詢為主 | 偏保守。Cvent 可改 [16]、Expo Pass 有條件可改 [31]、zkipster 可新增 [24] |
| check-in                         | App 有               | 一致 [9][16][23][30]                                                     |
| badges inventory                 | App 有，但不見列印   | 偏保守。Cvent／zkipster／Expo Pass 把列印放現場 [16][23][30]             |
| NFC bind／read／exchange         | App 有               | 不尋常（`(推論)`：同業公開文件以 QR／barcode 為主）[23][24][30][39]      |
| token／wallet ledger             | App 有               | 不尋常（`(推論)`：同業把付款／退款放 App，但少見完整 ledger）[5][17]     |

---

# 對 LinkCard 的含意

- **Web-only 的 content、sessions、polls、exhibitors 是業界標準，不應被當成 parity gap。** Whova 把 session 建立放在 Agenda Center [10]、Swapcard 把 session 與 exhibitor 放在 Studio [41][44]、並明文說 poll 建立只在 Web [37]；LinkCard 這四個模組留在 Web 完全一致。建議把這個切分寫成一份「intentional difference」清單，避免每季重新辯論。
- **Web-only 的 ticket types、badges 設計、bank transfers、org roles、settings 也一致，因為它們是設定層與財務層。** Eventbrite 的報名編輯只給 Event Dashboard [3]、zkipster 的欄位與權限在 browser／Account Settings [26][29]、Expo Pass 的 kiosk 權限要在 Event Settings 開 [31]；這些都是「低頻、高風險、需要審計」的操作，留在 Web 合理。
- **門側 App 以 check-in、walk-in、名單查詢、badge 庫存為主，方向正確；但 badge 只做 inventory 不做列印，比同業保守。** Cvent OnArrival 把 on-demand badge printing 當核心 [16]、zkipster 可在 App 現場列印 [23]、Expo Pass 的 kiosk 就是列印機 [30]。若 LinkCard 的現場流程需要印 badge，這會是實際缺口，而不是「刻意差異」。
- **最不尋常的是「報名資料編輯完全不在 App」——不是因為業界都禁止，而是三家競品明確把它放進現場流程。** Cvent 寫「Access or modify attendee details via desktop, phone, or tablet」[16]、Expo Pass 讓 kiosk 改 badge 欄位但要求 Web 先開權限與 passcode [31]、zkipster 可在 App 新增賓客與改 session 指派 [24]。建議 LinkCard 至少做「有限欄位 + 權限旗標 + 審計紀錄」的現場編輯，而不是維持唯讀；這比全面開放安全，也比完全不做更接近業界。
- **NFC bind／read／exchange 與 token／wallet ledger 是 LinkCard 比同業更激進的地方，屬於差異化而非標準。** 六家的公開文件都以 QR／barcode 掃描為現場主軸 [23][24][30][39]，未見「在門側 App 寫入 NFC credential」的公開說明；把 wallet ledger 放進門側 App 也超出 Cvent、Expo Pass、zkipster 的公開範圍 [5][17]。這不表示不該做，而是表示這兩個模組沒有產業共識可背書，應以 capability flag 與契約測試保護，並在文件中明說「這是 LinkCard 的刻意差異」。

---

# 來源

1. Eventbrite Help Center — Set up the Organizer App on your phone or tablet. https://www.eventbrite.com/help/en-us/articles/883605/set-up-the-organizer-app-on-your-phone-or-tablet
2. Eventbrite — Organizer Check-In App（產品頁）. http://eventbrite.com/organizer/features/organizer-check-in-app
3. Eventbrite Help Center — Edit attendee information and add notes. https://www.eventbrite.ca/help/en-ca/articles/544246/how-to-edit-attendee-information
4. Eventbrite Help Center — Create, manage, and check in guests on the Organizer App. https://www.eventbrite.com/help/en-us/articles/563516/create-manage-and-check-in-guests-on-the-organizer-app
5. Google Play — Eventbrite Organizer. https://play.google.com/store/apps/details?hl=en_US&id=com.eventbrite.organizer
6. Eventbrite — Online Event Registration & Management（功能頁）. https://www.eventbrite.com/features/registration/
7. Whova — Features. https://whova.com/features
8. Whova — Fast, Easy Event Check In App for Organizers. https://whova.com/event-management-software/paperless-check-in
9. Whova Help Center — Can I use the App to check in attendees? https://whova.zendesk.com/hc/en-us/articles/360020638492-Can-I-use-the-App-to-check-in-attendees
10. Whova Help Center — How can I add/set up sessions? https://whova.zendesk.com/hc/en-us/articles/11083901904795-How-can-I-add-set-up-sessions
11. Whova Help Center — How can Admin and Staff use mobile checkout on the Whova App? https://whova.zendesk.com/hc/en-us/articles/55994443047835-How-can-Admin-and-Staff-use-mobile-checkout-on-the-Whova-App
12. Whova — Speaker Guide（In-Person）. https://whova.com/pages/whova-speaker-guide-in-person
13. Whova — App Exhibitor Guide. https://whova.com/pages/whova-app-exhibitor-guide
14. Whova — Exhibitor & Trade Show Management. https://whova.com/trade-show-app-lead-retrieval
15. Whova — Live Polling. https://whova.com/event-management-software/live-polling
16. Cvent — Onsite Event Check-in and Badging Solutions（OnArrival）. https://www.cvent.com/en/event-marketing-management/onarrival-event-check-in-software
17. Cvent — Onsite Check-in and Badging Software（campaign 頁）. https://www.cvent.com/en/campaign/event-marketing-management/in-person-event-solutions-onarrival-event-check-in-software
18. Cvent — Attendee Hub. https://www.cvent.com/en/event-marketing-management/attendee-hub
19. Cvent — AI-Powered Event App（Attendee Hub Event App）. https://www.cvent.com/en/onsite-solutions/mobile-event-apps
20. App Store — OnArrival. https://apps.apple.com/il/app/onarrival/id680778967
21. Google Play — OnArrival. https://play.google.com/store/apps/details?hl=en_GB&id=com.cvent.onarrival
22. Cvent Release Notes — OnArrival Settings Enhancements. https://release.cvent.com/eventmanagement/board/onarrival-settings-enhancements
23. zkipster — Event check-in app for VIP guest management. https://www.zkipster.com/guestlistapp
24. zkipster Help Center — How to Check-in Guests on iOS and Android devices. https://support.zkipster.com/en/articles/3815820-how-to-check-in-guests-on-ios-and-android-devices
25. zkipster Help Center — How to Arrange Guest Fields on the zkipster App. https://support.zkipster.com/en/articles/2687319-how-to-arrange-guest-fields-on-the-zkipster-app
26. zkipster Help Center — How to Manage your Guest List. https://support.zkipster.com/en/articles/2687314-how-to-manage-your-guest-list
27. zkipster Help Center — How to Bulk Edit Guest Fields. https://support.zkipster.com/en/articles/2905754-how-to-bulk-edit-guest-fields
28. zkipster — 官方首頁（產品線）. https://www.zkipster.com/
29. zkipster Help Center — How to Add a New User to your Account. https://support.zkipster.com/en/articles/5354564-how-to-add-a-new-user-to-your-account
30. Expo Pass — On-Site Badge Printing & Event Check-In Software. https://www.expopass.com/check-in-badge-printing
31. Expo Pass Help Center — Onsite Check-In: Attendee Edits Their Own Data. https://support.expopass.com/en/articles/8006506-onsite-check-in-attendee-edits-their-own-data
32. Expo Pass Help Center — Onsite Logistics: Onsite Registration. https://support.expopass.com/en/articles/8944839-onsite-logistics-onsite-registration
33. Expo Pass — Mobile Event App. https://www.expopass.com/mobile-event-app
34. App Store — Expo Pass. https://apps.apple.com/us/app/expo-pass/id921625648
35. Expo Pass — Conference Management Software & Check-In. https://www.expopass.com/solutions/conferences
36. Swapcard — Features. https://www.swapcard.com/features
37. Swapcard Help Center — Managing Polls（Polls user guide）. https://help.swapcard.com/en/articles/8159023-managing-polls-polls-user-guide
38. Swapcard Help Center — Get Started with Swapcard as an Event Organizer. https://help.swapcard.com/en/articles/9423581-get-started-with-swapcard-as-an-event-organizer
39. Swapcard Help Center — Onsite Session Tracking with SwapAccess. https://help.swapcard.com/en/articles/9095307-onsite-session-tracking-with-swapaccess
40. Swapcard Help Center — Checkpoints with SwapAccess. https://help.swapcard.com/en/articles/9094906-checkpoints-with-swapaccess
41. Swapcard Help Center — Get started with Sessions. https://help.swapcard.com/en/articles/8159012-get-started-with-sessions
42. App Store — Swapcard: Smart Event App. https://apps.apple.com/gb/app/swapcard-smart-event-app/id879488719
43. Swapcard — Attendee Engagement Software. https://www.swapcard.com/features/attendee-engagement-software
44. Swapcard — Event Content & Session Management Platform. https://www.swapcard.com/features/event-content-session-management
45. App Store — SwapAccess. https://apps.apple.com/us/app/swapaccess/id1567018006
46. TrustRadius — Eventbrite Features（次級來源）. https://www.trustradius.com/products/eventbrite/features
47. Event Tech Stack — Event Tech Stack vs. Eventbrite（次級來源）. https://eventtechstack.com/event-tech-stack-vs-eventbrite
48. Cvent — In-Person Event Solutions（次級整理：Attendee Hub App 能力）. https://www.cvent.com/en/event-marketing-management/in-person-event-platform
49. Whova Help Center — How do I set up the Floormap? https://whova.zendesk.com/hc/en-us/articles/235878027-How-do-I-set-up-the-Floormap
50. Expo Pass — Products（Lead Retrieval 等）. https://www.expopass.com/features
51. Whova Help Center — Event Attendees 分類（含 How do I edit my registration information?）. https://whova.zendesk.com/hc/en-us/categories/200398767-Event-Attendees
52. Whova Help Center — How do I run attendee check-in? https://whova.zendesk.com/hc/en-us/articles/12564026324507-How-do-I-run-attendee-check-in
53. Whova — Event Registration Software. https://whova.com/event-registration-software/
