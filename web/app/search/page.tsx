import { Suspense } from "react";
import { SearchPage } from "@/components/SearchPage";

export default function Page() {
  return (
    <Suspense fallback={<section className="search" />}>
      <SearchPage />
    </Suspense>
  );
}
