#!/usr/bin/env bash
# Auto News Video — installer cho macOS
# Chạy bằng cách double-click file install.command trong Finder.

set -e

# Đảm bảo script chạy ở thư mục chứa nó
cd "$(dirname "$0")"

CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m'

clear
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║      AUTO NEWS VIDEO — Cài đặt tự động       ║"
echo "║          Phiên bản dành cho macOS            ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "Bạn không cần làm gì thêm, chỉ ngồi đợi 2-5 phút."
echo "Nếu macOS hỏi mật khẩu, hãy nhập mật khẩu máy tính của bạn."
echo ""
sleep 2

# 1. Cài Homebrew nếu chưa có
if ! command -v brew >/dev/null 2>&1; then
  echo -e "${YELLOW}→ Đang cài Homebrew (trình quản lý phần mềm cho macOS)...${NC}"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Thêm brew vào PATH cho phiên hiện tại (Apple Silicon)
  if [[ -d /opt/homebrew/bin ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
fi

# 2. Cài Node.js 22
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  echo -e "${YELLOW}→ Đang cài Node.js 22...${NC}"
  brew install node@22 || brew upgrade node@22 || true
  brew link --overwrite --force node@22 2>/dev/null || true
fi

# 3. Cài FFmpeg
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo -e "${YELLOW}→ Đang cài FFmpeg (công cụ xử lý video)...${NC}"
  brew install ffmpeg
fi

# 4. Cài thư viện npm
echo -e "${YELLOW}→ Đang cài thư viện cho phần lõi...${NC}"
npm install --no-audit --no-fund

echo -e "${YELLOW}→ Đang dựng giao diện web...${NC}"
(cd ui && npm install --no-audit --no-fund && npm run build)

# 5. Tạo shortcut chạy app trên Desktop
DESKTOP="$HOME/Desktop"
APP_DIR="$(pwd)"
LAUNCHER="$DESKTOP/Auto News Video.command"
cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
cd "$APP_DIR"
NO_OPEN=0 npm run server
EOF
chmod +x "$LAUNCHER"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          CÀI ĐẶT HOÀN TẤT                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "→ Để mở ứng dụng, double-click file ${CYAN}'Auto News Video.command'${NC}"
echo "  trên Desktop của bạn."
echo ""
echo -e "→ Lần đầu mở, hãy điền API key (hướng dẫn trong app)."
echo ""
echo "Bấm Enter để mở ứng dụng ngay bây giờ..."
read -r

# Khởi chạy luôn cho lần đầu
NO_OPEN=0 npm run server
