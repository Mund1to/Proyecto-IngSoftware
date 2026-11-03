// Evento de calendario (.ics) para agregar una entrevista a Google Calendar,
// Outlook o el calendario del teléfono. Formato iCalendar (RFC 5545).

type CalendarEvent = { uid: string; title: string; start: string; minutes: number; location?: string | null; description?: string | null };

// 2026-11-10T20:00:00.000Z -> 20261110T200000Z
const icsDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Escapa comas, punto y coma, barras y saltos de línea.
const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildIcs({ uid, title, start, minutes, location, description }: CalendarEvent): string {
  const begin = new Date(start);
  const end = new Date(begin.getTime() + minutes * 60000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SIPU//Entrevistas//ES",
    "BEGIN:VEVENT",
    `UID:${uid}@sipu`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(begin)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(title)}`,
    ...(location ? [`LOCATION:${icsText(location)}`] : []),
    ...(description ? [`DESCRIPTION:${icsText(description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
