import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <img
        src="/brand/shree-ganesh-erp.png"
        alt="Shree Ganesh ERP"
        className="h-36 w-auto max-w-full"
      />

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Shree Ganesh ERP presents
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Mushak</h1>
        <p className="mt-2 text-muted-foreground">
          Inventory management for small merchants.
        </p>
      </div>

      <img
        src="/brand/mushak.png"
        alt="Mushak mascot"
        className="h-40 w-auto max-w-full"
      />

      <Button>Get Started</Button>
    </main>
  );
}
