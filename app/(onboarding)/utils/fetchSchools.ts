import { geolocation } from "@blockshub/pawnote-lts";
import { t } from "i18next";

import { Services } from "@/stores/account/types";
import { useAlert } from "@/ui/components/AlertProvider";
import { GeographicQuerying, GeographicReverse } from "@/utils/native/georeverse";
import { calculateDistanceBetweenPositions, getCurrentPosition } from "@/utils/native/position";

export interface School {
  name: string,
  distance: number,
  url: string,
  ref?: unknown
}

export async function fetchSchools(service: Services, alert: ReturnType<typeof useAlert>, city?: string): Promise<School[]> {
  let pos = null;
  if (!city) {
    pos = await getCurrentPosition();

    if (pos === null) {
      alert.showAlert({
        title: t("Alert_No_Pos"),
        description: t("ONBOARDING_ALERT_NO_POSITION_DESCRIPTION"),
        icon: "AlertTriangle",
        color: "#D60046",
        withoutNavbar: true,
      });
    }
  }

  if (city) {
    pos = await GeographicQuerying(city);
  }

  if (service === Services.PRONOTE) {
    const schools = await geolocation({ latitude: pos?.latitude ?? 0, longitude: pos?.longitude ?? 0 });
    return schools.map(item => ({
      name: item.name,
      distance: item.distance / 10,
      url: item.url,
    }));
  }

  return [];
}
