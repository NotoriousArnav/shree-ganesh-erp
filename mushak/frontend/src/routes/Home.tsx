import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Mushak</h1>
        <p className="mt-2 text-muted-foreground">
          Inventory management for small merchants.
        </p>
        <Button className="mt-4">Get Started</Button>
      </div>
    </main>
  );
}
