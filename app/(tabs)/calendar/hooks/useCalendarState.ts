import { useState, useRef, useEffect, useCallback } from 'react';
import { Dimensions, FlatList } from 'react-native';
import { getWeekNumberFromDate } from "@/database/useHomework";
import { warn } from "@/utils/logger/logger";
import { useSettingsStore } from "@/stores/settings";

const INITIAL_INDEX = 10000;

export function useCalendarState() {
  const showWeekends = useSettingsStore(
    state => state.personalization.showWeekendsOnTimetable ?? false
  );

  const getBaseMonday = useCallback(() => {
    const d = new Date(referenceDate.current);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
    const diffToMon = day === 0 ? -6 : (1 - day);
    d.setDate(d.getDate() + diffToMon);
    return d;
  }, []);

  const getInitialDate = useCallback(() => {
    const now = new Date();
    if (!showWeekends) {
      if (now.getDay() === 6) {
        now.setDate(now.getDate() + 2); // Sat -> Mon
      } else if (now.getDay() === 0) {
        now.setDate(now.getDate() + 1); // Sun -> Mon
      }
    }
    return now;
  }, [showWeekends]);

  const [date, setDate] = useState(getInitialDate);
  const [weekNumber, setWeekNumber] = useState(getWeekNumberFromDate(date));
  const [currentIndex, setCurrentIndex] = useState(INITIAL_INDEX);
  const lastTrackedDateKey = useRef<string>("");
  const flatListRef = useRef<FlatList<any>>(null);
  const referenceDate = useRef(new Date());
  const windowWidth = Dimensions.get("window").width;

  useEffect(() => {
    referenceDate.current.setHours(0, 0, 0, 0);
  }, []);

  useEffect(() => {
    const dateKey = new Date(date).toDateString();
    if (lastTrackedDateKey.current === dateKey) {
      return;
    }
    lastTrackedDateKey.current = dateKey;
  }, [date]);

  const getDateFromIndex = useCallback((index: number) => {
    if (showWeekends) {
      const d = new Date(referenceDate.current);
      d.setDate(referenceDate.current.getDate() + (index - INITIAL_INDEX));
      return d;
    }

    const baseMon = getBaseMonday();
    const offset = index - INITIAL_INDEX;
    const weekOffset = Math.floor(offset / 5);
    const dayInWeek = ((offset % 5) + 5) % 5;
    const d = new Date(baseMon);
    d.setDate(baseMon.getDate() + weekOffset * 7 + dayInWeek);
    return d;
  }, [showWeekends, getBaseMonday]);

  const getIndexFromDate = useCallback((d: Date) => {
    if (showWeekends) {
      const base = new Date(referenceDate.current);
      base.setHours(0, 0, 0, 0);
      const target = new Date(d);
      target.setHours(0, 0, 0, 0);
      const diff = Math.round((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
      return INITIAL_INDEX + diff;
    }

    const baseMon = getBaseMonday();
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    if (target.getDay() === 6) {
      target.setDate(target.getDate() + 2);
    } else if (target.getDay() === 0) {
      target.setDate(target.getDate() + 1);
    }

    const diffDays = Math.round((target.getTime() - baseMon.getTime()) / (1000 * 60 * 60 * 24));
    const weekOffset = Math.floor(diffDays / 7);
    const dayInWeek = ((diffDays % 7) + 7) % 7;
    const offset = weekOffset * 5 + dayInWeek;
    return INITIAL_INDEX + offset;
  }, [showWeekends, getBaseMonday]);

  const handleDateChange = useCallback((newDate: Date) => {
    const adjustedDate = new Date(newDate);
    if (!showWeekends) {
      if (adjustedDate.getDay() === 6) {
        adjustedDate.setDate(adjustedDate.getDate() + 2);
      } else if (adjustedDate.getDay() === 0) {
        adjustedDate.setDate(adjustedDate.getDate() + 1);
      }
    }
    setDate(adjustedDate);
    const newWeekNumber = getWeekNumberFromDate(adjustedDate);
    if (newWeekNumber !== weekNumber) {
      setWeekNumber(newWeekNumber);
    }
  }, [weekNumber, showWeekends]);

  // Sync FlatList with date — même règle week-end que handleDateChange
  // (snap Sam/Dim -> Lun, pas de +1 ad hoc sur dimanche).
  useEffect(() => {
    const newIndex = getIndexFromDate(date);
    const snapped = new Date(date);
    if (!showWeekends) {
      if (snapped.getDay() === 6) {
        snapped.setDate(snapped.getDate() + 2);
      } else if (snapped.getDay() === 0) {
        snapped.setDate(snapped.getDate() + 1);
      }
    }
    const newWeekNumber = getWeekNumberFromDate(snapped);

    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      if (flatListRef.current) {
        try {
          flatListRef.current.scrollToIndex({
            index: newIndex,
            animated: false,
          });
        } catch (e) {
          warn(String(e))
        }
      }
    }

    if (newWeekNumber !== weekNumber) {
      setWeekNumber(newWeekNumber);
    }
  }, [date, getIndexFromDate, currentIndex, weekNumber, showWeekends]);

  const onMomentumScrollEnd = useCallback((e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      const newDate = getDateFromIndex(newIndex);
      setDate((prev) => prev.getTime() !== newDate.getTime() ? newDate : prev);
    }
  }, [windowWidth, currentIndex, getDateFromIndex]);

  const lastEmittedIndex = useRef(currentIndex);

  const onScroll = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / windowWidth);
    if (newIndex !== lastEmittedIndex.current) {
      lastEmittedIndex.current = newIndex;
      setCurrentIndex(newIndex);
      const newDate = getDateFromIndex(newIndex);
      setDate((prev) => prev.getTime() !== newDate.getTime() ? newDate : prev);
      const newWeekNumber = getWeekNumberFromDate(newDate);
      if (newWeekNumber !== weekNumber) {
        setWeekNumber(newWeekNumber);
      }
    }
  }, [windowWidth, getDateFromIndex, weekNumber]);

  return {
    date,
    setDate,
    weekNumber,
    setWeekNumber,
    currentIndex,
    flatListRef,
    getDateFromIndex,
    getIndexFromDate,
    handleDateChange,
    onMomentumScrollEnd,
    onScroll,
    INITIAL_INDEX,
    windowWidth
  };
}
