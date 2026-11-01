import type { ConsentDecisions } from "./state.js";

/**
 * Google Consent Mode v2 eşlemesi (gtag consent default/update sinyalleri).
 * marketing → ad_storage + ad_user_data + ad_personalization;
 * analytics → analytics_storage; personalization → personalization_storage.
 */
export interface ConsentModeV2 {
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
  analytics_storage: "granted" | "denied";
  personalization_storage: "granted" | "denied";
}

export function toConsentModeV2(decisions: ConsentDecisions): ConsentModeV2 {
  const signal = (granted: boolean): "granted" | "denied" => (granted ? "granted" : "denied");
  return {
    ad_storage: signal(decisions.marketing),
    ad_user_data: signal(decisions.marketing),
    ad_personalization: signal(decisions.marketing),
    analytics_storage: signal(decisions.analytics),
    personalization_storage: signal(decisions.personalization),
  };
}
