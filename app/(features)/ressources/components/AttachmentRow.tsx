import { Papicons } from "@getpapillon/papicons";
import React from "react";
import { Pressable, View } from "react-native";

import { hapticFor } from "@/utils/haptics";
import { getAttachmentIcon } from "@/utils/news/getAttachmentIcon";
import ActivityIndicator from "@/ui/components/ActivityIndicator";
import Icon from "@/ui/components/Icon";
import Typography from "@/ui/components/Typography";

import type { BuiltAttachment } from "../hooks/useRessourcesData";

interface AttachmentRowProps {
  attachment: BuiltAttachment;
  downloading: boolean;
  onOpen: (attachment: BuiltAttachment) => void;
}

/** Ligne pièce jointe / lien partagée (écran ressources + carte accueil
 *  si besoin) : feedback pressed, haptic léger, spinner par fichier. */
const AttachmentRow = React.memo(
  ({ attachment, downloading, onOpen }: AttachmentRowProps) => {
    return (
      <Pressable
        onPress={() => {
          void hapticFor("selection");
          onOpen(attachment);
        }}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 12,
            opacity: pressed ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={attachment.name || attachment.url}
      >
        <Icon>
          <Papicons name={getAttachmentIcon(attachment as never)} />
        </Icon>
        <Typography variant="body1" numberOfLines={1} style={{ flex: 1 }}>
          {attachment.name || attachment.url}
        </Typography>
        {downloading && <ActivityIndicator size={18} />}
      </Pressable>
    );
  }
);

AttachmentRow.displayName = "AttachmentRow";

export function AttachmentSeparator() {
  return <View style={{ height: 2 }} />;
}

export default AttachmentRow;
