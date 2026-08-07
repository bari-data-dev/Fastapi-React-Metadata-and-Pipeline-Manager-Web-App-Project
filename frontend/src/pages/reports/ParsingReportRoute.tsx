import { NumberedPaginationEnhancer } from "@/components/table/NumberedPaginationEnhancer";
import ParsingReportPage from "./ParsingReportPage";

export default function ParsingReportRoute() {
  return (
    <NumberedPaginationEnhancer enhanceReportScroll>
      <ParsingReportPage />
    </NumberedPaginationEnhancer>
  );
}
