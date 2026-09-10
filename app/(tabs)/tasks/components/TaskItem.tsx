import React, { memo, useCallback, useMemo, useState } from "react";
import Reanimated from "react-native-reanimated";

import { Homework } from "@/services/shared/homework";
import Task from "@/ui/components/Task";
import { AetherAppearIn, AetherAppearOut } from "@/ui/utils/Transition";
import { getSubjectName } from "@/utils/subjects/name";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { getSubjectColor } from "@/utils/subjects/colors";
import { hapticFor } from "@/utils/haptics";
import { Link } from "expo-router";
import { getHomeworkRouteId } from "@/database/useHomework";
import { scheduleTaskReminder } from "@/services/local/reminders";
import { areNotificationsEnabled } from "@/services/local/notifications";
import { useAlert } from "@/ui/components/AlertProvider";
import { formatHTML } from "@/utils/format/html";
import ReminderModal, { ReminderPreset } from "./ReminderModal";

interface TaskItemProps {
  item: Homework;
  index: number;
  fromCache?: boolean;
  setAsDone: (item: Homework, done: boolean) => void;
}

function stripHtml(s: string): string {
  try {
    return formatHTML(s)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  } catch {
    return String(s ?? "").slice(0, 120);
  }
}

const TaskItem = memo(
  ({ item, fromCache = false, setAsDone }: TaskItemProps) => {
    const alert = useAlert();
    const [modalVisible, setModalVisible] = useState(false);

    const presets: ReminderPreset[] = useMemo(() => {
      const now = Date.now();
      const tomorrowMorning = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        return d.getTime();
      })();
      return [
        { label: "Dans 1 heure", at: now + 60 * 60 * 1000 },
        { label: "Dans 12 heures", at: now + 12 * 60 * 60 * 1000 },
        { label: "Demain matin (8h)", at: tomorrowMorning },
        {
          label: "Chaque 1 heure",
          at: now + 60 * 60 * 1000,
          repeat: "hourly",
          hint: "Jusqu'à terminée",
        },
        {
          label: "Chaque 2 heures",
          at: now + 2 * 60 * 60 * 1000,
          repeat: "bihourly",
          hint: "Jusqu'à terminée",
        },
      ];
    }, []);

    const handleLongPress = useCallback(() => {
      void hapticFor("medium");
      setModalVisible(true);
    }, []);

    const handlePick = useCallback(
      async (p: ReminderPreset) => {
        setModalVisible(false);
        const ok = await areNotificationsEnabled().catch(() => false);
        if (!ok) {
          alert.showAlert({
            title: "Notifications désactivées",
            description: "Active les notifications pour recevoir ce rappel.",
            icon: "Bell",
            color: "#FF8C00",
            delay: 3000,
          });
          return;
        }
        const title = `${getSubjectName(item.subject)} — ${stripHtml(item.content)}`;
        const r = await scheduleTaskReminder(
          String((item as { id?: unknown }).id ?? getHomeworkRouteId(item)),
          title,
          p.at,
          p.repeat ?? "none"
        );
        alert.showAlert({
          title: r ? "Rappel ajouté" : "Échec",
          description: r
            ? "Retrouve-le dans Réglages → Rappels."
            : "Impossible de planifier ce rappel.",
          icon: r ? "CheckCircle" : "Cross",
          color: r ? "#00C851" : "#D60046",
          delay: 2500,
        });
      },
      [alert, item]
    );

    return (
      <Reanimated.View
        style={{ marginBottom: 10 }}
        entering={AetherAppearIn}
        exiting={AetherAppearOut}
      >
        <Link
          href={{
            pathname: "/(tabs)/tasks/[id]",
            params: { id: getHomeworkRouteId(item) },
          }}
          asChild
        >
          <Task
            subject={getSubjectName(item.subject)}
            emoji={getSubjectEmoji(item.subject)}
            title={""}
            color={getSubjectColor(item.subject)}
            description={item.content}
            date={new Date(item.dueDate)}
            completed={item.isDone}
            hasAttachments={item.attachments.length > 0}
            onToggle={() => {
              void hapticFor(item.isDone ? "light" : "success");
              setAsDone(item, !item.isDone);
            }}
            onLongPress={handleLongPress}
          />
        </Link>
        <ReminderModal
          visible={modalVisible}
          taskTitle={stripHtml(item.content)}
          subjectName={getSubjectName(item.subject)}
          isDone={item.isDone}
          presets={presets}
          onPick={handlePick}
          onClose={() => setModalVisible(false)}
        />
      </Reanimated.View>
    );
  }
);

TaskItem.displayName = "TaskItem";
export default TaskItem;
