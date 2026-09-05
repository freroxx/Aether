import React, { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated from 'react-native-reanimated';

import { Homework } from "@/services/shared/homework";
import Task from "@/ui/components/Task";
import { AetherAppearIn, AetherAppearOut } from '@/ui/utils/Transition';
import { getSubjectName } from "@/utils/subjects/name";
import { getSubjectEmoji } from "@/utils/subjects/emoji";
import { getSubjectColor } from "@/utils/subjects/colors";
import { Link } from 'expo-router';
import { getHomeworkRouteId } from '@/database/useHomework';

interface TaskItemProps {
  item: Homework;
  index: number;
  fromCache?: boolean;
  setAsDone: (item: Homework, done: boolean) => void;
}

const TaskItem = memo(
  ({
    item,
    fromCache = false,
    setAsDone
  }: TaskItemProps) => {
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
            onToggle={() => setAsDone(item, !item.isDone)}
          />
        </Link>
      </Reanimated.View>
    );
  }
);

TaskItem.displayName = "TaskItem";
export default TaskItem;
