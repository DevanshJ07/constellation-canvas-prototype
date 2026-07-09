import GalaxyCanvasV2 from "@/components/GalaxyCanvasV2";

export const metadata = {
  title: "Galaxy Canvas v2 · Prototype",
  description: "Isolated orbital star-system prototype with mock data",
};

export default function GalaxyV2Page() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <GalaxyCanvasV2 />
    </main>
  );
}
