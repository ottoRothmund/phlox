import { SpinnerGap } from "@phosphor-icons/react/dist/ssr";

export function PageLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <SpinnerGap size={16} className="animate-spin" />
        Loading repository signals
      </div>
      <div className="mt-8 border-t border-border">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="border-b border-border py-5">
            <div className="h-4 w-48 animate-pulse bg-subtle" />
            <div className="mt-3 h-3 w-2/3 animate-pulse bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
