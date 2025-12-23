"use client";

import { X, Info } from "lucide-react";
import { useTheme } from "../ThemeContext";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const { settings } = useTheme();

  // 字体修复：双重栈
  const fontStyle = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 模态框主体 */}
      <div className="relative w-full max-w-sm bg-white dark:bg-[#1e1e1e] modal-content rounded-3xl shadow-elevated overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">

        {/* 标题栏 (固定) */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5 dark:border-white/5 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-[var(--primary)]" />
            <h2 style={fontStyle} className="text-xl font-bold text-[var(--text-main)]">
              {settings.lang === "sc" ? "关于本站" : "關於本站"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <X className="w-6 h-6 text-[var(--text-sub)]" />
          </button>
        </div>

        {/* 
           内容区域 (可滚动)
           p-6 (24px): 统一设置四周内边距，确保左右留白完全一致，实现完美居中。
        */}
        <div className="overflow-y-auto custom-scrollbar p-6">
          <div className="space-y-4 text-sm leading-7 text-[var(--text-main)] opacity-90 text-justify" style={fontStyle}>

            {/* 简体中文内容 */}
            {settings.lang === "sc" ? (
              <>
                <p>
                  こんにちは、大家好。由于近日中日两国新闻存在矛盾和争议，必须把两边的新闻合在一起看才能获得完整的信息，因此本网站专注聚合日本媒体发布的中国相关新闻，尽力消除信息差，对一部分人来说是对日媒的一种监督，对另一部分人来说希望能让国内家人看到真实的本土信息报个平安。
                </p>
                <p>
                  网站会每小时自动抓取一次日本谷歌新闻中包含“中国”关键字的实时数据，会包含各家日媒发布的网页链接，不做任何修改和挑选，由爬虫自动爬取并按最新发布顺序显示（请注意，国内网友无法查看原文，只能看标题）。这些新闻之中可能也会夹杂一些错误抓取的新闻，比如日本本土也有叫“中国”的地区，日本股市里也有带“中国”名称的股票等等，目前还在持续优化中。
                </p>
                <p>
                  首页展示最近 100 条记录，超出 100 条后会自动移入下方存档栏永久保存。目前国内网友可正常访问本站，手机电脑均可，支持简繁切换和字体切换。本站全程由 Gemini + Antigravity 制作，处于试运营状态，还在持续更新优化中。由于版权问题，因此只能使用机翻来翻译标题，日文正文部分请自行打开查阅（摘录全文会被判定侵权）。如果你对这些新闻感兴趣，建议用手机浏览器将本页面添加到主屏幕（点击分享 → “添加到主屏幕”即可获得类App的体验）。如本站有重大更新会在这里发布公告。
                </p>
                <p>
                  本站目前零成本运营，连专属域名都买不起，如果你希望日后增加更多功能让本站更好，可以扫下方二维码给作者打个小赏凑点经费。经费充足的话会考虑集成更多实用功能甚至发布成正式app等等，最后，不论打赏多少金额都非常感谢！これからもよろしくお願いいたします。
                </p>
                <p className="text-mid font-bold mt-2">
                  一个在日华人，希望中日友好。
                </p>
              </>
            ) : (
              /* 繁体中文内容 */
              <>
                <p>
                  こんにちは、大家好。由於近日中日兩國新聞存在矛盾和爭議，必須把兩邊的新聞合在一起看才能獲得完整的信息，因此本網站專注聚合日本媒體發布的中國相關新聞，盡力消除信息差，對一部分人來說是對日媒的一種監督，對另一部分人來說希望能讓國內家人看到真實的本土信息報個平安。
                </p>
                <p>
                  網站會每小時自動抓取一次日本谷歌新聞中包含「中國」關鍵字的實時數據，會包含各家日媒發布的網頁鏈接，不做任何修改和挑選，由爬蟲自動爬取並按最新發布順序顯示（請注意，國內網友無法查看原文，只能看標題）。這些新聞之中可能也會夾雜一些錯誤抓取的新聞，比如日本本土也有叫「中國」的地區，日本股市里也有帶「中國」名稱的股票等等，目前還在持續優化中。
                </p>
                <p>
                  首頁展示最近 100 條記錄，超出 100 條后會自動移入下方存檔欄永久保存。目前國內網友可正常訪問本站，手機電腦均可，支持簡繁切換和字體切換。本站全程由 Gemini + Antigravity 製作，處於試運營狀態，還在持續更新優化中。由於版權問題，因此只能使用機翻來翻譯標題，日文正文部分請自行打開查閱（摘錄全文會被判定侵權）。如果你對這些新聞感興趣，建議用手機瀏覽器將本頁面添加到主屏幕（點擊分享 → 「添加到主屏幕」即可獲得類App的體驗）。如本站有重大更新會在這裡發布公告。
                </p>
                <p>
                  本站目前零成本運營，連專屬域名都買不起，如果你希望日后增加更多功能讓本站更好，可以掃下方二維碼給作者打個小賞湊點經費。經費充足的話會考慮集成更多實用功能甚至發布成正式app等等，最後，不論打賞多少金額都非常感謝！これからもよろしくお願いいたします。
                </p>
                <p className="text-mid font-bold mt-2">
                  一個在日華人，希望中日友好。
                </p>
              </>
            )}

            {/* 打赏二维码区域 */}
            <div className="pt-6 flex flex-col items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-black/5">
                <img
                  src="/qrcode.jpg"
                  alt="Donate QR Code"
                  className="w-[180px] h-[180px] object-contain rounded-lg"
                />
              </div>
              <span className="text-xs text-[var(--text-sub)] opacity-70">
                {settings.lang === "sc" ? "微信打赏" : "微信打賞"}
              </span>
            </div>

          </div>

          <div className="pt-8 pb-2 text-center">
            <p className="text-xs text-[var(--text-sub)] opacity-50">
              © 2025 China News From Japan
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}