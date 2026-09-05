export interface ParsedCalendarMetadata {
  prodId?: string;
  calendarName?: string;
}

export function parseCalendarMetadata(): ParsedCalendarMetadata {
  return {};
}

export function parseICalEvents(): any[] {
  return [];
}

export function parseICalString(): { events: any[]; metadata: ParsedCalendarMetadata } {
  return { events: [], metadata: {} };
}
