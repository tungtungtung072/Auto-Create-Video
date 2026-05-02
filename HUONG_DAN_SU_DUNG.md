# Hướng Dẫn Sử Dụng — Auto News Video

> Phần mềm tự tạo video tin tức ngắn (9:16) từ một bài báo bất kỳ.
> Bạn chỉ cần dán URL → ngồi đợi → có video sẵn để đăng TikTok / YouTube Shorts.

Không cần biết code, không cần dùng Terminal. Tất cả thao tác đều trong cửa sổ trình duyệt.

---

## 1. Mở ứng dụng

- **Mac:** Double-click file **`Auto News Video.command`** trên Desktop.
- **Windows:** Double-click file **`Auto News Video.bat`** trên Desktop.

Lần đầu mở, một cửa sổ Terminal/Command Prompt nhỏ sẽ hiện ra — đây là **server local** đang chạy trên máy bạn. **Đừng đóng cửa sổ đó** trong lúc dùng app. Khi muốn tắt app, đóng tab trình duyệt rồi đóng cửa sổ Terminal đó.

Sau ~5 giây, trình duyệt sẽ tự mở **http://localhost:5173**.

> Lưu ý: tất cả dữ liệu nằm offline trên máy bạn, **không upload lên đâu**. Thư mục lưu trữ là `~/Desktop/Auto-news-video/`.

---

## 2. Lần đầu — chạy "Trợ lý cài đặt"

Khi vào lần đầu, app sẽ dẫn bạn qua 4 bước thiết lập:

### Bước 1 — Chọn AI viết kịch bản
- **Khuyến nghị: Google Gemini (Miễn phí).**
- Lấy API key tại: https://aistudio.google.com/apikey (đăng nhập Google → bấm "Create API key" → copy chuỗi `AIza...`).
- Dán vào ô **API Key** trong app.

Các lựa chọn khác (tuỳ chọn — không bắt buộc):
- **OpenAI** (GPT-4o): https://platform.openai.com/api-keys — có phí.
- **Anthropic Claude**: https://console.anthropic.com/settings/keys — có phí.
- **Ollama** (chạy offline 100%): cần cài trước tại https://ollama.com — không cần API key.

### Bước 2 — Chọn giọng đọc tiếng Việt (TTS)
- **Khuyến nghị: LucyLab** (giọng tiếng Việt tự nhiên nhất, có gói miễn phí). Đăng ký tại https://lucylabs.ai.
- Hoặc **ElevenLabs** nếu bạn muốn giọng quốc tế: https://elevenlabs.io.
- Dán API Key + Voice ID. (Voice ID là chuỗi mã định danh giọng — copy từ trang chọn giọng của nhà cung cấp.)

### Bước 3 — Thương hiệu kênh
- Tên hiển thị (sẽ in trên video): vd `Công nghệ 24h`.
- Handle: vd `@congnghe24h`.

### Bước 4 — Hoàn tất
Bấm **Hoàn tất**. App sẽ lưu cài đặt (mã hoá API key trên máy bạn) và đưa bạn vào trang **Tạo video**.

> Bạn có thể đổi tất cả cài đặt sau này ở trang **Cài đặt** (mục bên trái sidebar).

---

## 3. Tạo video từ bài báo (chế độ thường xuyên)

### Cách 1 — Dùng URL bài báo (khuyến nghị)
1. Vào trang **Tạo mới** (icon `Tạo mới` trên sidebar).
2. Chọn tab **Từ URL bài báo**.
3. Dán đường dẫn bài viết (vd `https://vnexpress.net/...`).
4. (Tuỳ chọn) Bấm **Cài đặt nâng cao** để chọn:
   - **Tone** (Năng động / Chính thống / Hài hước / Phân tích).
   - **Số cảnh** muốn có (4–8).
   - **Thời lượng** mục tiêu (45–90 giây).
5. Bấm **Tạo video**.

### Cách 2 — Tự nhập nội dung
- Nếu bài báo bị chặn hoặc bạn có nội dung riêng, bấm tab **Từ file văn bản** rồi dán nội dung vào.

### Trong khi xử lý
Cột bên phải hiện **8 bước**:
1. Đọc URL → 2. Viết kịch bản → 3. Tải ảnh → 4. Đọc giọng → 5. Trộn nhạc nền → 6. Dựng cảnh → 7. Render video → 8. Hoàn tất.

Mỗi bước có icon ✓ / spinner / ⚠ trạng thái. Phía dưới có **terminal log** hiện chi tiết từng dòng.

### Bước "Xem lại kịch bản" (rất quan trọng)
Sau bước 2, app sẽ **tạm dừng** và hiện kịch bản gồm các scene đã viết. Bạn nên đọc lướt qua:
- Nếu OK → bấm **Duyệt & tiếp tục** để chạy tiếp (đọc giọng + render).
- Nếu thấy có chỗ sai (tên người sai, số liệu lệch...) → bấm **Hủy** rồi sửa nguồn / thử URL khác.
- Nếu bạn không bấm gì trong **30 giây**, app sẽ **tự động duyệt** và chạy tiếp — phù hợp cho ai muốn full automatic.

> Mẹo: mỗi câu kịch bản nên ngắn 1 dòng (~10–15 từ) để giọng đọc tự nhiên.

### Khi xong
Banner xanh hiện **"Video đã hoàn tất!"** — bấm **Mở video** để xem chi tiết, hoặc **Tạo video khác** để tiếp tục.

---

## 4. Thư viện video

Vào trang **Thư viện** để xem tất cả video đã tạo:
- Mỗi card hiển thị thumbnail (lấy từ frame thứ 30 của video), tên, thời lượng, trạng thái.
- Bấm vào card để vào **Chi tiết video**.

Trong **Chi tiết video** bạn có thể:

| Hành động | Mô tả |
|---|---|
| **Tải MP4** | Tải video gốc đã render về máy. |
| **Tải Voice.mp3** | Tải file giọng đọc riêng (để remix). |
| **Tải kịch bản (.txt)** | Tải kịch bản dạng text — dùng phụ đề / bài đăng. |
| **Mở thư mục local** | Copy đường dẫn thư mục chứa file để bạn mở Finder/Explorer. |
| **Render lại visual** | Render lại phần hình (giữ nguyên giọng đọc, không tốn TTS). Phù hợp khi bạn đổi nhạc nền hoặc branding. |
| **Xoá** | Xoá vĩnh viễn video + folder local. **Không thể phục hồi.** |

Tab **Kịch bản chi tiết** hiển thị từng scene + đoạn voice text, giúp bạn audit nội dung.

---

## 5. Cài đặt nâng cao

Vào trang **Cài đặt** để chỉnh:

- **AI viết kịch bản** — đổi nhà cung cấp / API key. Bấm **Test Connection** để kiểm tra key có dùng được không.
- **Giọng đọc (TTS)** — đổi nhà cung cấp / Voice ID.
- **Thương hiệu** — tên kênh, handle, follower hiển thị trên TikTok card cuối video.
- **Render** — bật/tắt TikTok card, chỉnh âm lượng nhạc nền và hiệu ứng âm thanh.
- **Lưu trữ** — đường dẫn folder lưu video (mặc định `~/Desktop/Auto-news-video`).

Trang **Trạng thái hệ thống** (link nhỏ ở chân sidebar) kiểm tra nhanh:
- Phiên bản Node.js / FFmpeg đã đúng chưa.
- Còn dung lượng đĩa không.
- API key đã cấu hình chưa.

---

## 6. Cấu trúc thư mục lưu trữ

Tất cả nằm trong **`~/Desktop/Auto-news-video/`**:

```
Auto-news-video/
├── videos/
│   ├── tin-cong-nghe-20260501-1432/
│   │   ├── video.mp4         ← video cuối cùng (9:16, có nhạc nền)
│   │   ├── voice.mp3         ← chỉ giọng đọc (không có nhạc)
│   │   ├── script.json       ← kịch bản dạng máy đọc
│   │   ├── script.txt        ← kịch bản dạng người đọc
│   │   ├── thumbnail.jpg     ← ảnh đại diện
│   │   └── voice/, scenes/   ← file trung gian (có thể xoá để tiết kiệm dung lượng)
│   └── ...
└── _app/
    ├── db.sqlite             ← lịch sử video + cài đặt (mã hoá)
    └── logs/                 ← log từng job để debug
```

> Bạn có thể copy folder `videos/` sang ổ ngoài để backup. Folder `_app/` là dữ liệu app, **không sao chép sang máy khác** (vì API key được mã hoá riêng theo máy).

---

## 7. Câu hỏi thường gặp

**Hỏi: Tôi đóng tab trình duyệt rồi vẫn còn cửa sổ Terminal — đóng được không?**
Được, nhưng đóng Terminal sẽ tắt server. Lần sau muốn dùng lại phải double-click shortcut "Auto News Video" trên Desktop.

**Hỏi: Render bị lỗi giữa chừng?**
Vào trang **Chi tiết video** → tab **Log thực thi** xem dòng nào lỗi. Hầu hết lỗi do (1) hết quota API, (2) URL bài báo bị chặn / quá ít chữ. Thử lại với URL khác hoặc đợi qua quota miễn phí.

**Hỏi: Render lâu quá?**
Render 1 video 60s mất ~3–5 phút trên Mac M1 / PC mới, ~7–10 phút trên máy yếu. CPU sẽ chạy 100% trong khi render — đây là bình thường.

**Hỏi: Có thể chạy nhiều job song song không?**
**Không.** Render rất tốn CPU/RAM. App giới hạn 1 job tại 1 thời điểm để máy không lag. Xếp hàng tự động xử lý.

**Hỏi: Đổi nhạc nền / hiệu ứng được không?**
Phiên bản hiện tại dùng pool nhạc/SFX có sẵn (file trong folder `audio/`). Bạn có thể thêm file `.mp3` vào `audio/bgm/` hoặc `audio/sfx/` rồi render lại — app tự động chọn ngẫu nhiên.

**Hỏi: Xoá video xong có khôi phục được không?**
**Không.** Xoá là xoá luôn folder + record DB. Hãy chắc chắn trước khi bấm xoá.

**Hỏi: Tôi mất API key, phải lấy lại?**
API key được mã hoá lưu trên máy. Vào **Cài đặt** → ô API Key sẽ thấy `••••` (đã mask). Bạn không xem lại được key cũ — nếu cần thay, dán key mới vào và bấm **Lưu**.

**Hỏi: Tôi muốn upload thẳng lên TikTok / YouTube?**
Tính năng auto-upload sẽ có ở phiên bản sau. Hiện tại bạn tải MP4 về và upload thủ công (mất 30 giây).

---

## 8. Liên hệ / báo lỗi

Nếu thấy bug hoặc cần thêm tính năng, gửi log file (`~/Desktop/Auto-news-video/_app/logs/<jobId>.log`) cho người cài đặt giúp bạn.

Chúc bạn làm video vui!
