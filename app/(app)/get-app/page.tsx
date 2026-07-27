import QRCode from "qrcode";
import { CopyLinkButton } from "@/components/get-app/copy-link-button";

export default async function GetAppPage() {
  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const mobileUrl = `${baseUrl}/m`;
  const qrCodeDataUrl = await QRCode.toDataURL(mobileUrl, {
    margin: 1,
    color: { dark: "#0d141b", light: "#ffffff" }
  });

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Get Subbie Updates on your phone</h1>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mt-2">
            Post site updates, view Site Instructions, and get notified of replies — right from your home screen.
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrCodeDataUrl}
          alt="QR code to install Subbie Updates"
          className="size-56 rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white p-3"
        />

        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          Scan this with your phone's camera, or open the link below on your phone.
        </p>

        <div className="w-full flex flex-col sm:flex-row items-center gap-3">
          <code className="flex-1 w-full text-left text-sm bg-[#f6f7f8] dark:bg-slate-800 rounded-lg px-3 py-2 truncate">
            {mobileUrl}
          </code>
          <CopyLinkButton url={mobileUrl} />
        </div>

        <div className="w-full text-left bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl p-5 mt-4">
          <h2 className="text-sm font-bold mb-3">Once it's open on your phone</h2>
          <div className="flex flex-col gap-3 text-sm text-[#4c739a] dark:text-slate-400">
            <p>
              <span className="font-bold text-[#0d141b] dark:text-slate-50">Android (Chrome):</span> tap the{" "}
              <span className="font-bold text-[#0d141b] dark:text-slate-50">Install App</span> button that appears on
              the page.
            </p>
            <p>
              <span className="font-bold text-[#0d141b] dark:text-slate-50">iPhone (Safari):</span> tap the Share icon,
              then <span className="font-bold text-[#0d141b] dark:text-slate-50">Add to Home Screen</span>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
