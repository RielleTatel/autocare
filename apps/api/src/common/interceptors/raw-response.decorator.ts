import { SetMetadata } from "@nestjs/common";

export const RAW_RESPONSE = "raw_response";

/**
 * Opt a handler out of the success envelope. Reserved for responses whose body
 * IS the payload — a CSV download, a file stream — where `{ success, data }`
 * would corrupt the document. Never use it to reshape a JSON API response.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);
