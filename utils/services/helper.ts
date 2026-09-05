import { ImageSourcePropType } from "react-native";

import { Services } from "@/stores/account/types";

export function getServiceName(service: Services): string {
  switch(service) {
  case Services.MOCK_DATA:
    return "Mock Data";
  default:
    return "Pronote";
  }
}

export function getServiceLogo(service: Services): ImageSourcePropType {
  switch(service) {
  case Services.MOCK_DATA:
    return require("@/assets/images/icon.png")
  default:
    return require("@/assets/images/service_pronote.png")
  }
}

export function getServiceBackground(service: Services): ImageSourcePropType {
  void service;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/assets/images/icon.png")
}

export function getServiceColor(service: Services): string {
  void service;
  return "#1B8A6B"
}

export function getCodeType(service: Services): string {
  void service;
  return "QR"
}

export function isSelfModuleEnabledED(additionals?: Record<string, any>): boolean {
  void additionals;
  return false;
}
