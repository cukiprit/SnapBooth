import { PhotoBooth } from "@/components/camera/photo-booth";

export default function HomePage() {
  return (
    <main className="bg-pixel-grid min-h-screen pb-12">
      {/* Top Brutalist Arcade Header */}
      <header className="border-b-[3px] border-zinc-950 bg-[#facc15] px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="brutal-box flex h-11 w-11 items-center justify-center bg-[#f43f5e] font-pixel text-lg font-bold text-white">
              SB
            </div>
            <div>
              <h1 className="font-pixel text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
                SNAPBOOTH.EXE
              </h1>

            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="brutal-btn bg-[#a3e635] px-2.5 py-1 font-pixel text-[11px] font-bold uppercase">
              ● LIVE CAM
            </span>
            <span className="brutal-btn bg-white px-2.5 py-1 font-pixel text-[11px] font-bold uppercase">
              FREE PLAY
            </span>
          </div>
        </div>
      </header>

      <div className="pt-6">
        <PhotoBooth />
      </div>
    </main>
  );
}
