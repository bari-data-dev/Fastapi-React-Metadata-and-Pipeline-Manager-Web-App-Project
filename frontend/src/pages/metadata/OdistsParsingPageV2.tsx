import { NumberedPaginationEnhancer } from "@/components/table/NumberedPaginationEnhancer";
import OdistsParsingPage from "./OdistsParsingPage";

export default function OdistsParsingPageV2() {
  return (
    <NumberedPaginationEnhancer>
      <OdistsParsingPage />
    </NumberedPaginationEnhancer>
  );
}
