import { NumberedPaginationEnhancer } from "@/components/table/NumberedPaginationEnhancer";
import ParsingReportPageV3 from "./ParsingReportPageV3";

export default function ParsingReportRoute() {
  return (
    <NumberedPaginationEnhancer enhanceReportScroll>
      <ParsingReportPageV3 />
    </NumberedPaginationEnhancer>
  );
}
