import { NumberedPaginationEnhancer } from "@/components/table/NumberedPaginationEnhancer";
import OdistsParsingPage from "./OdistsParsingPage";

export default function OdistsParsingRoute() {
  return (
    <NumberedPaginationEnhancer>
      <OdistsParsingPage />
    </NumberedPaginationEnhancer>
  );
}
