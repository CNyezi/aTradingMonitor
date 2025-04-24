import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function BuiltWithButton() {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      href="https://nexty.dev"
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "px-4 rounded-md bg-transparent border-gray-500 hover:bg-gray-950 text-white hover:text-gray-100"
      )}
    >
      <span>Built with</span>
      <span>
        <LogoNexty className="size-4 rounded-full" />
      </span>
      <span className="font-bold text-base-content flex gap-0.5 items-center tracking-tight">
        Nexty.dev
      </span>
    </a>
  );
}

function LogoNexty({ className }: { className?: string }) {
  return (
    <img
      src="/logo_nexty.svg"
      alt="Logo"
      title="Logo"
      width={96}
      height={96}
      className={cn("size-8 rounded-md", className)}
    />
  );
}
