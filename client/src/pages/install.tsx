import * as React from "react";
import InstallAppButton from "../components/InstallAppButton";

export default function InstallPage() {
  return <main className="min-h-screen bg-[#050714] px-5 py-12 text-white">
    <div className="mx-auto max-w-xl space-y-7 text-center">
      <img src="/brand/fantasy-arena-logo.jpg" alt="Fantasy Arena" className="mx-auto h-32 w-32 rounded-3xl" />
      <h1 className="text-4xl font-black">Install Fantasy Arena</h1>
      <p className="text-slate-300">Play, collect and compete from your home screen.</p>
      <InstallAppButton />
      <section className="rounded-3xl border border-cyan-300/20 bg-white/5 p-6 text-left space-y-4">
        <h2 className="text-xl font-bold">Android</h2>
        <p>Tap Install App to download the latest Android app. Open the downloaded APK and confirm installation. If Android asks, allow this browser to install this download.</p>
        <h2 className="text-xl font-bold">iPhone and iPad</h2>
        <p>Open this page in Safari, tap Share, then Add to Home Screen and Add.</p>
        <h2 className="text-xl font-bold">Install the web app</h2>
        <p>In Chrome or Edge, open the browser menu and choose Install app or Add to Home Screen when available.</p>
        <p className="text-sm text-slate-400">Viewing this inside Instagram or Facebook? Open the link in your phone’s browser first.</p>
      </section>
      <div className="space-y-3"><h2 className="text-xl font-bold">Scan to install</h2><img src="/brand/install-qr.svg" alt="QR code linking to https://playfantasyarena.com/install" className="mx-auto w-60 rounded-xl bg-white" /><a href="/brand/install-qr.svg" download="Fantasy-Arena-Install-QR.svg" className="block text-cyan-200 underline">Download QR code for your posts</a></div>
      <a href="/free" className="inline-block rounded-2xl bg-cyan-300 px-6 py-3 font-bold text-slate-950">Continue in browser</a>
      <p className="text-sm text-slate-400">playfantasyarena.com/install</p>
    </div>
  </main>;
}
